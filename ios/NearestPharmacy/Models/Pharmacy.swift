import CoreLocation
import Foundation

struct Pharmacy: Identifiable, Hashable, Sendable {
    let id: String
    var name: String?
    var latitude: Double
    var longitude: Double
    var address: String?
    var phone: String?
    var url: URL?

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    var displayName: String {
        name ?? String(localized: "Pharmacy")
    }
}

/// A pharmacy together with its distance from the search origin.
struct RankedPharmacy: Identifiable, Hashable, Sendable {
    let pharmacy: Pharmacy
    /// Metres from the search origin.
    let distance: CLLocationDistance

    var id: Pharmacy.ID { pharmacy.id }
}
