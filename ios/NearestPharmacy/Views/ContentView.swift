import MapKit
import SwiftUI

struct ContentView: View {
    let finder: PharmacyFinder

    @State private var query = ""
    @State private var camera: MapCameraPosition = .region(MapFraming.initialRegion)

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                PharmacyMap(finder: finder, camera: $camera)
                    .containerRelativeFrame(.vertical) { height, _ in height * 0.45 }
                ResultsPanel(finder: finder)
            }
            .navigationTitle("Nearest Pharmacy")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(
                text: $query,
                placement: .navigationBarDrawer(displayMode: .always),
                prompt: Text("Search an address or place")
            )
            .onSubmit(of: .search) { finder.search(address: query) }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        finder.useCurrentLocation()
                    } label: {
                        Label("Use my location", systemImage: "location.fill")
                    }
                }
            }
        }
        // Finding the nearest pharmacy is the whole point, so start right away.
        .task { finder.useCurrentLocation() }
        .onChange(of: finder.origin) { frameCamera() }
        .onChange(of: finder.selectedID) { frameCamera() }
    }

    /// Keeps the origin and the selected pharmacy (the nearest one by default) in view.
    private func frameCamera() {
        guard let origin = finder.origin else { return }
        let region = MapFraming.region(framing: origin.coordinate, and: finder.selected?.pharmacy.coordinate)
        withAnimation { camera = .region(region) }
    }
}
