import CoreLocation
import Foundation

enum DistanceFormatter {
    /// "350 m" below one kilometre, "1.2 km" / "1,2 km" (locale-aware) up to 10 km, whole kilometres beyond.
    static func string(for meters: CLLocationDistance, locale: Locale = .current) -> String {
        if meters < 1_000 {
            let rounded = max(10, (meters / 10).rounded() * 10)
            return Measurement(value: rounded, unit: UnitLength.meters)
                .formatted(.measurement(width: .abbreviated, usage: .asProvided).locale(locale))
        }
        let kilometers = meters / 1_000
        let fractionDigits = kilometers < 10 ? 1 : 0
        return Measurement(value: kilometers, unit: UnitLength.kilometers)
            .formatted(
                .measurement(
                    width: .abbreviated,
                    usage: .asProvided,
                    numberFormatStyle: .number.precision(.fractionLength(0...fractionDigits))
                )
                .locale(locale)
            )
    }
}
