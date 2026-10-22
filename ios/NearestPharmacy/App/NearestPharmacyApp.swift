import SwiftUI

@main
@MainActor
struct NearestPharmacyApp: App {
    @State private var finder = PharmacyFinder(
        provider: MapKitPharmacyProvider(),
        locator: LocationProvider(),
        geocoder: MapKitGeocoder()
    )

    var body: some Scene {
        WindowGroup {
            ContentView(finder: finder)
        }
    }
}
