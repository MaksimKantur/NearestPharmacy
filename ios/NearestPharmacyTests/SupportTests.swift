import CoreLocation
import Foundation
import Testing
@testable import NearestPharmacy

struct GeoTests {
    @Test func distanceIsZeroForTheSamePoint() {
        #expect(Geo.distance(from: helsinki, to: helsinki) == 0)
    }

    @Test func distanceMatchesHelsinkiToStockholm() {
        let stockholm = CLLocationCoordinate2D(latitude: 59.3293, longitude: 18.0686)
        let km = Geo.distance(from: helsinki, to: stockholm) / 1_000
        #expect(abs(km - 396) < 3)
    }

    @Test func rankSortsNearestFirstAndDropsDuplicates() {
        let ranked = Geo.rank(
            [pharmacy("b", metersNorth: 200), pharmacy("a", metersNorth: 100), pharmacy("b", metersNorth: 200)],
            from: helsinki
        )
        #expect(ranked.map(\.id) == ["a", "b"])
        #expect(abs(ranked[0].distance - 100) < 2)
    }

    @Test func directionsURLAsksAppleMapsForWalkingDirections() throws {
        let url = Geo.directionsURL(from: helsinki, to: CLLocationCoordinate2D(latitude: 60.17, longitude: 24.94))
        let items = try #require(URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems)
        let query = Dictionary(uniqueKeysWithValues: items.map { ($0.name, $0.value ?? "") })
        #expect(url.host == "maps.apple.com")
        #expect(query["saddr"] == "60.1699,24.9384")
        #expect(query["daddr"] == "60.17,24.94")
        #expect(query["dirflg"] == "w")
    }
}

struct DistanceFormatterTests {
    /// Foundation may use (narrow) no-break spaces between number and unit.
    private func format(_ meters: Double, _ locale: String) -> String {
        DistanceFormatter.string(for: meters, locale: Locale(identifier: locale))
            .replacingOccurrences(of: "\u{00A0}", with: " ")
            .replacingOccurrences(of: "\u{202F}", with: " ")
    }

    @Test func metresAreRoundedToTens() {
        #expect(format(347, "en_US") == "350 m")
        #expect(format(3, "en_US") == "10 m")
    }

    @Test func kilometresGetOneDecimalBelowTen() {
        #expect(format(1_234, "en_US") == "1.2 km")
        #expect(format(1_234, "fi_FI") == "1,2 km")
    }

    @Test func wholeKilometresFromTen() {
        #expect(format(12_600, "en_US") == "13 km")
    }
}

struct MapFramingTests {
    @Test func framesBothPointsWithMargin() {
        let target = CLLocationCoordinate2D(latitude: 60.18, longitude: 24.96)
        let region = MapFraming.region(framing: helsinki, and: target)

        #expect(abs(region.center.latitude - (helsinki.latitude + target.latitude) / 2) < 1e-9)
        #expect(region.span.latitudeDelta > abs(target.latitude - helsinki.latitude))
        #expect(region.span.longitudeDelta > abs(target.longitude - helsinki.longitude))
    }

    @Test func centresOnTheOriginWhenThereIsNoTarget() {
        let region = MapFraming.region(framing: helsinki, and: nil)
        #expect(region.center.latitude == helsinki.latitude)
        #expect(region.center.longitude == helsinki.longitude)
    }
}
