export interface GeoPosition {
  latitude: number;
  longitude: number;
}

/**
 * Wraps navigator.geolocation. No reverse-geocoding provider is wired yet
 * (Yandex Geocoder arrives in M3 per ARCHITECTURE) — callers get coordinates
 * and ask the customer to type/confirm the readable address themselves.
 */
export function getCurrentPosition(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolokatsiya bu qurilmada mavjud emas'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => {
        const message =
          err.code === err.PERMISSION_DENIED
            ? "Joylashuvga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering yoki manzilni qo'lda kiriting"
            : "Joylashuvni aniqlab bo'lmadi. Manzilni qo'lda kiriting";
        reject(new Error(message));
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}
