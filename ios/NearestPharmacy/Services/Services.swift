import CoreLocation

/// Finds pharmacies around a point. The MapKit implementation is used in the
/// app; tests substitute a fake.
protocol PharmacyProvider {
    func pharmacies(near center: CLLocationCoordinate2D, radius: CLLocationDistance) async throws -> [Pharmacy]
}

/// One-shot access to the device location, including the permission prompt.
@MainActor
protocol LocationProviding {
    func currentLocation() async throws -> CLLocationCoordinate2D
}

enum LocationError: Error, Equatable {
    case denied
    case unavailable
}

struct GeocodedPlace: Equatable {
    var name: String
    var latitude: Double
    var longitude: Double

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

/// Turns free-form text (an address or a place name) into a coordinate.
protocol Geocoding {
    /// `nil` when nothing matches.
    func place(for query: String) async throws -> GeocodedPlace?
}
