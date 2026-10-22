import MapKit

/// Pharmacies from Apple Maps' point-of-interest database. No API key needed.
struct MapKitPharmacyProvider: PharmacyProvider {
    func pharmacies(near center: CLLocationCoordinate2D, radius: CLLocationDistance) async throws -> [Pharmacy] {
        let request = MKLocalPointsOfInterestRequest(center: center, radius: radius)
        request.pointOfInterestFilter = MKPointOfInterestFilter(including: [.pharmacy])
        do {
            let response = try await MKLocalSearch(request: request).start()
            return response.mapItems.map(Pharmacy.init(mapItem:))
        } catch MKError.placemarkNotFound {
            // MapKit reports "nothing in this area" as an error.
            return []
        }
    }
}

extension Pharmacy {
    init(mapItem: MKMapItem) {
        let placemark = mapItem.placemark
        let coordinate = placemark.coordinate
        let name = mapItem.name

        let street = [placemark.thoroughfare, placemark.subThoroughfare].compactMap { $0 }.joined(separator: " ")
        let city = [placemark.postalCode, placemark.locality].compactMap { $0 }.joined(separator: " ")
        let address = [street, city].filter { !$0.isEmpty }.joined(separator: ", ")

        self.init(
            // MKMapItem has no stable identifier before iOS 18; name + position is unique enough.
            id: "\(name ?? "")@\(coordinate.latitude),\(coordinate.longitude)",
            name: name,
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            address: address.isEmpty ? nil : address,
            phone: mapItem.phoneNumber,
            url: mapItem.url
        )
    }
}
