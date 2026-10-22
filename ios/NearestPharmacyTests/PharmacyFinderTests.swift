import CoreLocation
import Testing
@testable import NearestPharmacy

@MainActor
struct PharmacyFinderTests {
    private func makeFinder(
        provider: FakeProvider,
        locator: FakeLocator? = nil,
        geocoder: FakeGeocoder = FakeGeocoder()
    ) -> PharmacyFinder {
        // Default arguments are evaluated outside the main actor, so the locator is built here.
        PharmacyFinder(provider: provider, locator: locator ?? FakeLocator(.success(helsinki)), geocoder: geocoder)
    }

    @Test func findsNearestFromCurrentLocationAndSelectsIt() async {
        let provider = FakeProvider { _, _ in
            [pharmacy("far", metersNorth: 300), pharmacy("near", metersNorth: 100), pharmacy("mid", metersNorth: 200)]
        }
        let finder = makeFinder(provider: provider)

        finder.useCurrentLocation()
        await finder.waitForCurrentAction()

        #expect(finder.status == .loaded)
        #expect(finder.origin?.kind == .currentLocation)
        #expect(finder.pharmacies.map(\.id) == ["near", "mid", "far"])
        #expect(finder.selectedID == "near")
        #expect(provider.requestedRadii == [PharmacyFinder.searchRadii[0]])
    }

    @Test func widensTheRadiusUntilSomethingIsFound() async {
        let provider = FakeProvider { _, radius in
            radius < 10_000 ? [] : [pharmacy("rural", metersNorth: 8_000)]
        }
        let finder = makeFinder(provider: provider)

        finder.search(from: helsinki)
        await finder.waitForCurrentAction()

        #expect(finder.pharmacies.map(\.id) == ["rural"])
        #expect(provider.requestedRadii == [500, 2_000, 10_000])
    }

    @Test func ignoresResultsBeyondTheRequestedRadius() async {
        // MapKit can return items slightly outside the radius; a 3 km result at the
        // 500 m step must not win over a closer one found at the 2 km step.
        let provider = FakeProvider { _, radius in
            radius == 500 ? [pharmacy("outside", metersNorth: 3_000)] : [pharmacy("closer", metersNorth: 1_500)]
        }
        let finder = makeFinder(provider: provider)

        finder.search(from: helsinki)
        await finder.waitForCurrentAction()

        #expect(finder.nearest?.id == "closer")
    }

    @Test func reportsWhenNothingIsWithinTheLargestRadius() async {
        let provider = FakeProvider { _, _ in [] }
        let finder = makeFinder(provider: provider)

        finder.search(from: helsinki)
        await finder.waitForCurrentAction()

        #expect(finder.status == .failed(.noPharmacies))
        #expect(provider.requestedRadii == PharmacyFinder.searchRadii)
    }

    @Test func limitsTheNumberOfResults() async {
        let many = (0..<50).map { pharmacy("p\($0)", metersNorth: Double($0) * 5) }
        let finder = makeFinder(provider: FakeProvider { _, _ in many })

        finder.search(from: helsinki)
        await finder.waitForCurrentAction()

        #expect(finder.pharmacies.count == PharmacyFinder.resultLimit)
    }

    @Test func mapsDeniedPermission() async {
        let finder = makeFinder(
            provider: FakeProvider { _, _ in [] },
            locator: FakeLocator(.failure(LocationError.denied))
        )

        finder.useCurrentLocation()
        await finder.waitForCurrentAction()

        #expect(finder.status == .failed(.locationDenied))
        #expect(finder.origin == nil)
    }

    @Test func mapsOtherLocationFailures() async {
        let finder = makeFinder(
            provider: FakeProvider { _, _ in [] },
            locator: FakeLocator(.failure(LocationError.unavailable))
        )

        finder.useCurrentLocation()
        await finder.waitForCurrentAction()

        #expect(finder.status == .failed(.locationUnavailable))
    }

    @Test func searchesFromAGeocodedAddress() async {
        let place = GeocodedPlace(name: "Mannerheimintie 1", latitude: helsinki.latitude, longitude: helsinki.longitude)
        let finder = makeFinder(
            provider: FakeProvider { _, _ in [pharmacy("a", metersNorth: 50)] },
            geocoder: FakeGeocoder(places: ["Mannerheimintie 1": place])
        )

        finder.search(address: "  Mannerheimintie 1 ")
        await finder.waitForCurrentAction()

        #expect(finder.origin?.kind == .address("Mannerheimintie 1"))
        #expect(finder.status == .loaded)
    }

    @Test func reportsUnknownAddresses() async {
        let finder = makeFinder(provider: FakeProvider { _, _ in [] })

        finder.search(address: "qwzxqwzx")
        await finder.waitForCurrentAction()

        #expect(finder.status == .failed(.addressNotFound("qwzxqwzx")))
    }

    @Test func ignoresBlankAddresses() async {
        let finder = makeFinder(provider: FakeProvider { _, _ in [] })

        finder.search(address: "   ")
        await finder.waitForCurrentAction()

        #expect(finder.status == .idle)
    }

    @Test func networkFailureCanBeRetried() async {
        var shouldFail = true
        let provider = FakeProvider { _, _ in
            if shouldFail { throw TestError() }
            return [pharmacy("a", metersNorth: 50)]
        }
        let finder = makeFinder(provider: provider)

        finder.search(from: helsinki)
        await finder.waitForCurrentAction()
        #expect(finder.status == .failed(.searchFailed))

        shouldFail = false
        finder.retry()
        await finder.waitForCurrentAction()
        #expect(finder.status == .loaded)
        #expect(finder.nearest?.id == "a")
    }

    @Test func aNewSearchSupersedesASlowerOne() async {
        let other = CLLocationCoordinate2D(latitude: 59.3293, longitude: 18.0686)
        let provider = FakeProvider { center, _ in
            if center.latitude == helsinki.latitude {
                try await Task.sleep(for: .milliseconds(300))
                return [pharmacy("stale", metersNorth: 10)]
            }
            return [Pharmacy(id: "fresh", latitude: other.latitude, longitude: other.longitude)]
        }
        let finder = makeFinder(provider: provider)

        finder.search(from: helsinki)
        finder.search(from: other)
        await finder.waitForCurrentAction()
        try? await Task.sleep(for: .milliseconds(400))

        #expect(finder.pharmacies.map(\.id) == ["fresh"])
        #expect(finder.origin?.latitude == other.latitude)
    }
}
