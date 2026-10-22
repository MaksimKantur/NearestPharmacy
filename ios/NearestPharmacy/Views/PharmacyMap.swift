import MapKit
import SwiftUI

struct PharmacyMap: View {
    let finder: PharmacyFinder
    @Binding var camera: MapCameraPosition

    var body: some View {
        MapReader { proxy in
            Map(position: $camera) {
                ForEach(finder.pharmacies) { item in
                    Marker(item.pharmacy.displayName, systemImage: "cross.fill", coordinate: item.pharmacy.coordinate)
                        .tint(tint(for: item))
                }
                if let origin = finder.origin {
                    Annotation(origin.mapTitle, coordinate: origin.coordinate) {
                        OriginDot()
                    }
                }
            }
            // Our own markers replace Apple's pharmacy icons; other places stay for orientation.
            .mapStyle(.standard(pointsOfInterest: .excluding([.pharmacy])))
            .mapControls {
                MapCompass()
                MapScaleView()
            }
            .onTapGesture(coordinateSpace: .local) { point in
                handleTap(at: point, proxy: proxy)
            }
        }
    }

    private func tint(for item: RankedPharmacy) -> Color {
        if item.id == finder.nearest?.id { return .accentColor }
        if item.id == finder.selectedID { return .blue }
        return .gray
    }

    /// A tap on (or right next to) a marker selects that pharmacy; a tap anywhere
    /// else searches from that point. Done by hand because a map-wide tap gesture
    /// and Map's built-in selection don't coexist reliably on iOS 17.
    private func handleTap(at point: CGPoint, proxy: MapProxy) {
        // Marker balloons are drawn above their coordinate, so a tap on one lands
        // ~20 pt higher than the coordinate itself.
        let markerCenter = CGPoint(x: point.x, y: point.y + 20)
        let hit = finder.pharmacies
            .compactMap { item -> (RankedPharmacy.ID, CGFloat)? in
                guard let p = proxy.convert(item.pharmacy.coordinate, to: .local) else { return nil }
                return (item.id, hypot(p.x - markerCenter.x, p.y - markerCenter.y))
            }
            .filter { $0.1 < 28 }
            .min { $0.1 < $1.1 }

        if let hit {
            finder.selectedID = hit.0
        } else if let coordinate = proxy.convert(point, from: .local) {
            finder.search(from: coordinate)
        }
    }
}

private struct OriginDot: View {
    var body: some View {
        Circle()
            .fill(.blue)
            .frame(width: 16, height: 16)
            .overlay(Circle().stroke(.white, lineWidth: 3))
            .shadow(radius: 2)
    }
}

private extension PharmacyFinder.Origin {
    var mapTitle: String {
        switch kind {
        case .currentLocation: String(localized: "You are here")
        case .address(let name): name
        case .mapPoint: String(localized: "Selected point on the map")
        }
    }
}
