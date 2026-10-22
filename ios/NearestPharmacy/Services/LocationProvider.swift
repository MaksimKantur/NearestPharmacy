import CoreLocation

/// Wraps CLLocationManager's delegate callbacks in a single async call.
@MainActor
final class LocationProvider: NSObject, LocationProviding {
    private let manager = CLLocationManager()
    private var authorizationContinuation: CheckedContinuation<Void, Never>?
    private var locationContinuation: CheckedContinuation<CLLocationCoordinate2D, Error>?

    override init() {
        super.init()
        manager.delegate = self
        // Street-level accuracy is plenty and resolves much faster than "best".
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    func currentLocation() async throws -> CLLocationCoordinate2D {
        if manager.authorizationStatus == .notDetermined {
            await withCheckedContinuation { continuation in
                authorizationContinuation = continuation
                manager.requestWhenInUseAuthorization()
            }
        }

        switch manager.authorizationStatus {
        case .denied, .restricted:
            throw LocationError.denied
        default:
            break
        }

        // A newer request supersedes one still in flight.
        locationContinuation?.resume(throwing: CancellationError())
        return try await withCheckedThrowingContinuation { continuation in
            locationContinuation = continuation
            manager.requestLocation()
        }
    }

    private func finishLocation(with result: Result<CLLocationCoordinate2D, Error>) {
        locationContinuation?.resume(with: result)
        locationContinuation = nil
    }
}

// CLLocationManager calls its delegate on the thread it was created on — the main thread here.
extension LocationProvider: CLLocationManagerDelegate {
    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        MainActor.assumeIsolated {
            guard manager.authorizationStatus != .notDetermined else { return }
            authorizationContinuation?.resume()
            authorizationContinuation = nil
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let coordinate = locations.last?.coordinate else { return }
        MainActor.assumeIsolated {
            finishLocation(with: .success(coordinate))
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        let denied = (error as? CLError)?.code == .denied
        MainActor.assumeIsolated {
            finishLocation(with: .failure(denied ? LocationError.denied : LocationError.unavailable))
        }
    }
}
