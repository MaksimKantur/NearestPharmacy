import CoreLocation
import Observation

/// Owns the "where is the user → which pharmacies are closest" flow.
///
/// Every action supersedes the previous one: the running task is cancelled and
/// its late results are dropped, so a slow search can never overwrite a newer one.
@MainActor
@Observable
final class PharmacyFinder {
    enum Status: Equatable {
        case idle
        case locating
        case geocoding
        case searching
        case loaded
        case failed(FinderError)
    }

    enum FinderError: Error, Equatable {
        case locationDenied
        case locationUnavailable
        case addressNotFound(String)
        case searchFailed
        case noPharmacies
    }

    struct Origin: Equatable {
        enum Kind: Equatable {
            case currentLocation
            case address(String)
            case mapPoint
        }

        var latitude: Double
        var longitude: Double
        var kind: Kind
        /// Radius of uncertainty in metres; set for device locations.
        var accuracy: CLLocationDistance?

        init(_ coordinate: CLLocationCoordinate2D, kind: Kind, accuracy: CLLocationDistance? = nil) {
            latitude = coordinate.latitude
            longitude = coordinate.longitude
            self.kind = kind
            self.accuracy = accuracy
        }

        var coordinate: CLLocationCoordinate2D {
            CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
        }

        /// Above this many metres of uncertainty the UI suggests searching an address instead.
        static let approximateAccuracy: CLLocationDistance = 1_000

        /// Too rough to trust for "nearest" — e.g. a Wi-Fi/cell fix indoors.
        var isApproximate: Bool {
            (accuracy ?? 0) > Self.approximateAccuracy
        }
    }

    /// Search radii in metres. We stop at the first radius with results: anything
    /// outside radius R is farther than everything inside it. Starting small keeps
    /// MapKit's capped result list focused on what's actually closest.
    static let searchRadii: [CLLocationDistance] = [500, 2_000, 10_000, 25_000]
    static let resultLimit = 20

    private(set) var status: Status = .idle
    private(set) var origin: Origin?
    private(set) var pharmacies: [RankedPharmacy] = []
    var selectedID: RankedPharmacy.ID?

    var nearest: RankedPharmacy? { pharmacies.first }
    var selected: RankedPharmacy? { pharmacies.first { $0.id == selectedID } }

    private let provider: PharmacyProvider
    private let locator: LocationProviding
    private let geocoder: Geocoding
    @ObservationIgnored private var task: Task<Void, Never>?
    @ObservationIgnored private var lastAction: (() -> Void)?

    init(provider: PharmacyProvider, locator: LocationProviding, geocoder: Geocoding) {
        self.provider = provider
        self.locator = locator
        self.geocoder = geocoder
    }

    // MARK: - Actions

    func useCurrentLocation() {
        run(retry: { [weak self] in self?.useCurrentLocation() }) { [self] in
            status = .locating
            let location: CLLocation
            do {
                location = try await locator.currentLocation()
            } catch {
                guard !Task.isCancelled else { return }
                status = .failed(error as? LocationError == .denied ? .locationDenied : .locationUnavailable)
                return
            }
            guard !Task.isCancelled else { return }
            // A negative accuracy means CoreLocation couldn't estimate it.
            let accuracy = location.horizontalAccuracy >= 0 ? location.horizontalAccuracy : nil
            await search(from: Origin(location.coordinate, kind: .currentLocation, accuracy: accuracy))
        }
    }

    func search(address query: String) {
        let query = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return }
        run(retry: { [weak self] in self?.search(address: query) }) { [self] in
            status = .geocoding
            let place: GeocodedPlace?
            do {
                place = try await geocoder.place(for: query)
            } catch {
                guard !Task.isCancelled else { return }
                status = .failed(.searchFailed)
                return
            }
            guard !Task.isCancelled else { return }
            guard let place else {
                status = .failed(.addressNotFound(query))
                return
            }
            await search(from: Origin(place.coordinate, kind: .address(place.name)))
        }
    }

    func search(from coordinate: CLLocationCoordinate2D) {
        run(retry: { [weak self] in self?.search(from: coordinate) }) { [self] in
            await search(from: Origin(coordinate, kind: .mapPoint))
        }
    }

    func retry() {
        lastAction?()
    }

    /// Waits for the current action to finish. Used by tests.
    func waitForCurrentAction() async {
        await task?.value
    }

    // MARK: - Search

    /// Pharmacies around `center`, nearest first. Empty if none within the largest radius.
    func nearestPharmacies(around center: CLLocationCoordinate2D) async throws -> [RankedPharmacy] {
        for radius in Self.searchRadii {
            try Task.checkCancellation()
            let found = try await provider.pharmacies(near: center, radius: radius)
            // MapKit may include a few results beyond the radius; dropping them keeps
            // the "nearest inside R is nearest overall" argument sound.
            let ranked = Geo.rank(found, from: center).filter { $0.distance <= radius }
            if !ranked.isEmpty {
                return Array(ranked.prefix(Self.resultLimit))
            }
        }
        return []
    }

    private func search(from origin: Origin) async {
        self.origin = origin
        pharmacies = []
        selectedID = nil
        status = .searching
        do {
            let found = try await nearestPharmacies(around: origin.coordinate)
            guard !Task.isCancelled else { return }
            pharmacies = found
            selectedID = found.first?.id
            status = found.isEmpty ? .failed(.noPharmacies) : .loaded
        } catch {
            guard !Task.isCancelled else { return }
            status = .failed(.searchFailed)
        }
    }

    private func run(retry: @escaping () -> Void, _ operation: @escaping @MainActor () async -> Void) {
        task?.cancel()
        lastAction = retry
        task = Task { await operation() }
    }
}
