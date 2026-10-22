import CoreLocation
import Foundation
@testable import NearestPharmacy

let helsinki = CLLocationCoordinate2D(latitude: 60.1699, longitude: 24.9384)

func deviceLocation(_ coordinate: CLLocationCoordinate2D = helsinki, accuracy: CLLocationDistance = 10) -> CLLocation {
    CLLocation(coordinate: coordinate, altitude: 0, horizontalAccuracy: accuracy, verticalAccuracy: -1, timestamp: Date())
}

/// A pharmacy roughly `metersNorth` metres north of Helsinki centre.
func pharmacy(_ id: String, metersNorth: Double) -> Pharmacy {
    Pharmacy(id: id, name: id, latitude: helsinki.latitude + metersNorth / 111_200, longitude: helsinki.longitude)
}

struct TestError: Error {}

/// Returns whatever `results` gives for each radius and records the radii asked for.
final class FakeProvider: PharmacyProvider {
    var results: (CLLocationCoordinate2D, CLLocationDistance) async throws -> [Pharmacy]
    private(set) var requestedRadii: [CLLocationDistance] = []

    init(results: @escaping (CLLocationCoordinate2D, CLLocationDistance) async throws -> [Pharmacy]) {
        self.results = results
    }

    func pharmacies(near center: CLLocationCoordinate2D, radius: CLLocationDistance) async throws -> [Pharmacy] {
        requestedRadii.append(radius)
        return try await results(center, radius)
    }
}

@MainActor
final class FakeLocator: LocationProviding {
    var result: Result<CLLocation, Error>

    init(_ result: Result<CLLocation, Error>) {
        self.result = result
    }

    func currentLocation() async throws -> CLLocation {
        try result.get()
    }
}

struct FakeGeocoder: Geocoding {
    var places: [String: GeocodedPlace] = [:]
    var error: Error?

    func place(for query: String) async throws -> GeocodedPlace? {
        if let error { throw error }
        return places[query]
    }
}
