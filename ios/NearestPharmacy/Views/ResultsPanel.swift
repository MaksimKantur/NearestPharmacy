import SwiftUI

struct ResultsPanel: View {
    let finder: PharmacyFinder

    var body: some View {
        ScrollViewReader { reader in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    StatusView(finder: finder)

                    if let origin = finder.origin, finder.status == .loaded {
                        OriginLabel(origin: origin)
                    }

                    if let origin = finder.origin, origin.isApproximate, let accuracy = origin.accuracy,
                       finder.status != .locating {
                        Text("Your location is approximate (±\(DistanceFormatter.string(for: accuracy))). For an exact result, search your address or tap your spot on the map.")
                            .font(.subheadline)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(.yellow.opacity(0.15), in: RoundedRectangle(cornerRadius: 12))
                    }

                    if let origin = finder.origin, let nearest = finder.nearest {
                        SectionHeader("Nearest pharmacy")
                        NearestPharmacyCard(
                            item: nearest,
                            origin: origin.coordinate,
                            isSelected: finder.selectedID == nearest.id,
                            onSelect: { finder.selectedID = nearest.id }
                        )

                        if finder.pharmacies.count > 1 {
                            SectionHeader("Other pharmacies nearby")
                            ForEach(finder.pharmacies.dropFirst()) { item in
                                PharmacyRow(
                                    item: item,
                                    origin: origin.coordinate,
                                    isSelected: finder.selectedID == item.id,
                                    onSelect: { finder.selectedID = item.id }
                                )
                                .id(item.id)
                            }
                        }
                    }
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            // Follow selections made on the map. The nearest card is always at the top.
            .onChange(of: finder.selectedID) {
                guard let id = finder.selectedID, id != finder.nearest?.id else { return }
                withAnimation { reader.scrollTo(id, anchor: .center) }
            }
        }
    }
}

private struct StatusView: View {
    let finder: PharmacyFinder
    @Environment(\.openURL) private var openURL

    var body: some View {
        switch finder.status {
        case .idle:
            Text("Allow location access, search an address or tap the map to find the nearest pharmacy.")
                .foregroundStyle(.secondary)
        case .locating:
            ProgressRow("Getting your location…")
        case .geocoding:
            ProgressRow("Looking up the address…")
        case .searching:
            ProgressRow("Finding pharmacies nearby…")
        case .loaded:
            Text("Tip: tap anywhere on the map to search from that point.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        case .failed(let error):
            VStack(alignment: .leading, spacing: 10) {
                Label {
                    Text(error.message)
                } icon: {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.orange)
                }
                if error == .searchFailed {
                    Button("Try again") { finder.retry() }
                        .buttonStyle(.bordered)
                }
                if error == .locationDenied, let settings = URL(string: UIApplication.openSettingsURLString) {
                    Button("Open Settings") { openURL(settings) }
                        .buttonStyle(.bordered)
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
        }
    }
}

private struct ProgressRow: View {
    let text: LocalizedStringKey

    init(_ text: LocalizedStringKey) {
        self.text = text
    }

    var body: some View {
        HStack(spacing: 10) {
            ProgressView()
            Text(text).foregroundStyle(.secondary)
        }
    }
}

private struct OriginLabel: View {
    let origin: PharmacyFinder.Origin

    var body: some View {
        Label {
            switch origin.kind {
            case .currentLocation: Text("Your location")
            case .address(let name): Text(verbatim: name)
            case .mapPoint: Text("Selected point on the map")
            }
        } icon: {
            Image(systemName: "smallcircle.filled.circle").foregroundStyle(.blue)
        }
        .font(.subheadline)
        .foregroundStyle(.secondary)
    }
}

private struct SectionHeader: View {
    let title: LocalizedStringKey

    init(_ title: LocalizedStringKey) {
        self.title = title
    }

    var body: some View {
        Text(title)
            .font(.caption.weight(.bold))
            .textCase(.uppercase)
            .foregroundStyle(.secondary)
            .padding(.top, 4)
    }
}

extension PharmacyFinder.FinderError {
    var message: LocalizedStringResource {
        switch self {
        case .locationDenied:
            "Location access is off. Search an address or tap the map instead."
        case .locationUnavailable:
            "Couldn't determine your location. Search an address or tap the map instead."
        case .addressNotFound(let query):
            "No place found for “\(query)”."
        case .searchFailed:
            "Couldn't load pharmacies. Check your connection and try again."
        case .noPharmacies:
            "No pharmacies found within 25 km of this point."
        }
    }
}
