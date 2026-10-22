import MapKit

/// Address and place search via MapKit, so "Mannerheimintie 1" and
/// "Helsinki Central Station" both work.
struct MapKitGeocoder: Geocoding {
    func place(for query: String) async throws -> GeocodedPlace? {
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = query
        request.resultTypes = [.address, .pointOfInterest]
        do {
            guard let item = try await MKLocalSearch(request: request).start().mapItems.first else {
                return nil
            }
            let coordinate = item.placemark.coordinate
            return GeocodedPlace(
                name: item.name ?? query,
                latitude: coordinate.latitude,
                longitude: coordinate.longitude
            )
        } catch MKError.placemarkNotFound {
            return nil
        }
    }
}
