// Minimal ambient surface for the Yandex Maps JS API global — only the
// handful of calls live-tracking-map.tsx actually uses. Not the full
// @types/yandex-maps package (avoids a dependency for ~15 lines of surface).
interface YMapsPlacemark {
  geometry: { setCoordinates: (coords: [number, number]) => void };
}

interface YMapsMap {
  geoObjects: { add: (placemark: YMapsPlacemark) => void };
  setBounds: (bounds: [[number, number], [number, number]], options?: { checkZoomRange?: boolean }) => void;
  destroy: () => void;
}

interface YMapsNamespace {
  ready: (callback: () => void) => void;
  Map: new (
    element: HTMLElement,
    state: { center: [number, number]; zoom: number; controls?: string[] },
  ) => YMapsMap;
  Placemark: new (
    coords: [number, number],
    properties?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => YMapsPlacemark;
}

interface Window {
  ymaps?: YMapsNamespace;
}
