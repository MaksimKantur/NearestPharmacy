import MapKit

enum MapFraming {
    /// Helsinki — shown until we know where the user is.
    static let initialRegion = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 60.1699, longitude: 24.9384),
        latitudinalMeters: 8_000,
        longitudinalMeters: 8_000
    )

    /// A region showing both the search origin and `target`, with some margin,
    /// or a street-level view of the origin alone.
    static func region(framing origin: CLLocationCoordinate2D, and target: CLLocationCoordinate2D?) -> MKCoordinateRegion {
        guard let target else {
            return MKCoordinateRegion(center: origin, latitudinalMeters: 1_500, longitudinalMeters: 1_500)
        }
        let center = CLLocationCoordinate2D(
            latitude: (origin.latitude + target.latitude) / 2,
            longitude: (origin.longitude + target.longitude) / 2
        )
        // 0.004° ≈ 400 m: keeps the map from zooming in absurdly when the pharmacy is next door.
        let span = MKCoordinateSpan(
            latitudeDelta: max(abs(origin.latitude - target.latitude) * 2.2, 0.004),
            longitudeDelta: max(abs(origin.longitude - target.longitude) * 2.2, 0.004)
        )
        return MKCoordinateRegion(center: center, span: span)
    }
}
