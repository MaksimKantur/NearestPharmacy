import CoreLocation
import SwiftUI

/// The highlighted card for the closest pharmacy, with all available actions.
struct NearestPharmacyCard: View {
    let item: RankedPharmacy
    let origin: CLLocationCoordinate2D
    let isSelected: Bool
    let onSelect: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button(action: onSelect) {
                PharmacySummary(item: item, nameFont: .title3.weight(.semibold))
            }
            .buttonStyle(.plain)

            HStack {
                Link(destination: Geo.directionsURL(from: origin, to: item.pharmacy.coordinate)) {
                    Label("Directions", systemImage: "figure.walk")
                }
                .buttonStyle(.borderedProminent)

                if let phone = item.pharmacy.phone, let url = URL(string: "tel:\(phone.filter { !$0.isWhitespace })") {
                    Link(destination: url) {
                        Label("Call", systemImage: "phone.fill")
                    }
                    .buttonStyle(.bordered)
                }

                if let website = item.pharmacy.url {
                    Link(destination: website) {
                        Label("Website", systemImage: "safari")
                    }
                    .buttonStyle(.bordered)
                }
            }
            .labelStyle(.titleAndIcon)
            .controlSize(.small)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.accentColor.opacity(0.1), in: RoundedRectangle(cornerRadius: 14))
        .overlay {
            RoundedRectangle(cornerRadius: 14)
                .stroke(isSelected ? Color.blue : Color.accentColor, lineWidth: isSelected ? 2 : 1)
        }
    }
}

struct PharmacyRow: View {
    let item: RankedPharmacy
    let origin: CLLocationCoordinate2D
    let isSelected: Bool
    let onSelect: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            Button(action: onSelect) {
                PharmacySummary(item: item, nameFont: .body.weight(.semibold))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            Link(destination: Geo.directionsURL(from: origin, to: item.pharmacy.coordinate)) {
                Label("Directions", systemImage: "figure.walk")
                    .labelStyle(.iconOnly)
            }
            .buttonStyle(.bordered)
        }
        .padding(12)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
        .overlay {
            if isSelected {
                RoundedRectangle(cornerRadius: 12).stroke(Color.blue, lineWidth: 2)
            }
        }
    }
}

private struct PharmacySummary: View {
    let item: RankedPharmacy
    let nameFont: Font

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(item.pharmacy.displayName)
                .font(nameFont)
                .foregroundStyle(.primary)
            Text("\(DistanceFormatter.string(for: item.distance)) away")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Color.accentColor)
            if let address = item.pharmacy.address {
                Text(address)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .multilineTextAlignment(.leading)
    }
}
