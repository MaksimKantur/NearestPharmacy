import CoreLocation
import Foundation

enum Geo {
    /// Geodesic distance in metres.
    static func distance(from a: CLLocationCoordinate2D, to b: CLLocationCoordinate2D) -> CLLocationDistance {
        CLLocation(latitude: a.latitude, longitude: a.longitude)
            .distance(from: CLLocation(latitude: b.latitude, longitude: b.longitude))
    }

    /// Pharmacies ordered nearest first, with duplicates (same id) removed.
    static func rank(_ pharmacies: [Pharmacy], from origin: CLLocationCoordinate2D) -> [RankedPharmacy] {
        var seen = Set<Pharmacy.ID>()
        return pharmacies
            .filter { seen.insert($0.id).inserted }
            .map { RankedPharmacy(pharmacy: $0, distance: distance(from: origin, to: $0.coordinate)) }
            .sorted { $0.distance < $1.distance }
    }

    /// Walking directions in Apple Maps.
    static func directionsURL(from origin: CLLocationCoordinate2D, to destination: CLLocationCoordinate2D) -> URL {
        var components = URLComponents(string: "https://maps.apple.com/")!
        components.queryItems = [
            URLQueryItem(name: "saddr", value: "\(origin.latitude),\(origin.longitude)"),
            URLQueryItem(name: "daddr", value: "\(destination.latitude),\(destination.longitude)"),
            URLQueryItem(name: "dirflg", value: "w"),
        ]
        return components.url!
    }
}
