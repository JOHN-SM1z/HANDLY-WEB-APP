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

/**
 * Continuous tracking for live GPS sharing (order EN_ROUTE/IN_PROGRESS).
 * Wraps watchPosition — the browser itself decides callback frequency based
 * on movement/accuracy, so no manual polling interval is needed. Returns an
 * unsubscribe function; callers must call it on unmount (React Strict Mode's
 * double-effect would otherwise leave a stray watch running).
 */
export function watchPosition(
  onUpdate: (pos: GeoPosition) => void,
  onError: (message: string) => void,
): () => void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onError('Geolokatsiya bu qurilmada mavjud emas');
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => onUpdate({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
    (err) => {
      const message =
        err.code === err.PERMISSION_DENIED
          ? "Joylashuvga ruxsat berilmadi. Jonli kuzatish uchun brauzer sozlamalaridan ruxsat bering"
          : "Joylashuvni aniqlab bo'lmadi";
      onError(message);
    },
    { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}
