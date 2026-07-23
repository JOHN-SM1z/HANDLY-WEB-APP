'use client';

import { useEffect, useRef, useState } from 'react';
import type { LocationUpdatedEvent } from '@handly/contracts';
import { emitLocation, useSocketEvent } from '@/lib/socket';
import { watchPosition, type GeoPosition } from '@/lib/geo';
import { Alert } from '@/components/ui/alert';

const YANDEX_MAPS_API_KEY = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
const SCRIPT_ID = 'yandex-maps-sdk';

let loadPromise: Promise<void> | null = null;

/** Loads the Yandex Maps JS API script once and caches the promise across mounts. */
function loadYandexMaps(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    if (window.ymaps) {
      resolve();
      return;
    }
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Xarita skripti yuklanmadi')));
      return;
    }
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(YANDEX_MAPS_API_KEY!)}&lang=ru_RU`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Xarita skripti yuklanmadi'));
    document.head.appendChild(script);
  });
  return loadPromise;
}

interface LiveTrackingMapProps {
  /** Whether GPS sharing should be active right now (order is ASSIGNED/EN_ROUTE/IN_PROGRESS). */
  active: boolean;
  /** Seeds the map before any live update arrives — e.g. the order's original address pin. */
  initialCounterpartPosition?: GeoPosition | null;
  counterpartLabel: string;
}

/**
 * Bidirectional live GPS (both directions, per explicit product decision) —
 * each side runs this component, broadcasting its own watchPosition stream
 * and rendering the other party's incoming `location:updated` events. No
 * location is ever persisted — purely a socket relay (see RealtimeGateway).
 * Renders a graceful "not configured" placeholder when no Yandex Maps API
 * key is set, same "assists, never blocks" shape as Sentry/AI/Push in this
 * codebase — the location data pipeline itself works regardless of whether
 * a map is visually available.
 */
export function LiveTrackingMap({
  active,
  initialCounterpartPosition,
  counterpartLabel,
}: LiveTrackingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<YMapsMap | null>(null);
  const selfMarkerRef = useRef<YMapsPlacemark | null>(null);
  const counterpartMarkerRef = useRef<YMapsPlacemark | null>(null);

  const [selfPos, setSelfPos] = useState<GeoPosition | null>(null);
  const [counterpartPos, setCounterpartPos] = useState<GeoPosition | null>(
    initialCounterpartPosition ?? null,
  );
  const [geoError, setGeoError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Broadcast this device's own position while tracking is active.
  useEffect(() => {
    if (!active) return;
    const unsubscribe = watchPosition(
      (pos) => {
        setSelfPos(pos);
        setGeoError(null);
        emitLocation(pos.latitude, pos.longitude);
      },
      (message) => setGeoError(message),
    );
    return unsubscribe;
  }, [active]);

  // Receive the counterpart's position.
  useSocketEvent<LocationUpdatedEvent>('location:updated', (payload) => {
    setCounterpartPos({ latitude: payload.lat, longitude: payload.lng });
  });

  // Load the map SDK and mount the map once we have at least one coordinate to center on.
  useEffect(() => {
    if (!active || !YANDEX_MAPS_API_KEY) return;
    const center = selfPos ?? counterpartPos;
    if (!center || !containerRef.current || mapRef.current) return;

    let cancelled = false;
    loadYandexMaps()
      .then(() => {
        if (cancelled || !containerRef.current || !window.ymaps) return;
        window.ymaps.ready(() => {
          if (cancelled || !containerRef.current || mapRef.current || !window.ymaps) return;
          const map = new window.ymaps.Map(containerRef.current, {
            center: [center.latitude, center.longitude],
            zoom: 14,
            controls: ['zoomControl'],
          });
          mapRef.current = map;
          setMapReady(true);
        });
      })
      .catch(() => setGeoError('Xarita yuklanmadi'));

    return () => {
      cancelled = true;
    };
  }, [active, selfPos, counterpartPos]);

  // Keep the self/counterpart placemarks in sync with the latest coordinates.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.ymaps) return;
    const map = mapRef.current;

    if (selfPos) {
      const coords: [number, number] = [selfPos.latitude, selfPos.longitude];
      if (selfMarkerRef.current) {
        selfMarkerRef.current.geometry.setCoordinates(coords);
      } else {
        const marker = new window.ymaps.Placemark(
          coords,
          { hintContent: 'Siz' },
          { preset: 'islands#blueCircleIcon' },
        );
        selfMarkerRef.current = marker;
        map.geoObjects.add(marker);
      }
    }

    if (counterpartPos) {
      const coords: [number, number] = [counterpartPos.latitude, counterpartPos.longitude];
      if (counterpartMarkerRef.current) {
        counterpartMarkerRef.current.geometry.setCoordinates(coords);
      } else {
        const marker = new window.ymaps.Placemark(
          coords,
          { hintContent: counterpartLabel },
          { preset: 'islands#redCircleIcon' },
        );
        counterpartMarkerRef.current = marker;
        map.geoObjects.add(marker);
      }
    }

    if (selfPos && counterpartPos) {
      const lats = [selfPos.latitude, counterpartPos.latitude];
      const lngs = [selfPos.longitude, counterpartPos.longitude];
      map.setBounds(
        [
          [Math.min(...lats), Math.min(...lngs)],
          [Math.max(...lats), Math.max(...lngs)],
        ],
        { checkZoomRange: true },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, selfPos, counterpartPos, counterpartLabel]);

  // Tear down the map instance on unmount/deactivation.
  useEffect(() => {
    if (active) return;
    return () => {
      mapRef.current?.destroy();
      mapRef.current = null;
      selfMarkerRef.current = null;
      counterpartMarkerRef.current = null;
      setMapReady(false);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border-tertiary bg-surface p-3 shadow-card">
      <p className="text-sm font-semibold text-content-primary">Jonli joylashuv</p>
      {geoError && <Alert>{geoError}</Alert>}
      {YANDEX_MAPS_API_KEY ? (
        <div ref={containerRef} className="h-56 w-full overflow-hidden rounded-lg bg-background-secondary" />
      ) : (
        <div className="flex flex-col gap-1 rounded-lg bg-background-secondary p-3 text-xs text-content-secondary">
          <p>Xarita sozlanmagan (NEXT_PUBLIC_YANDEX_MAPS_API_KEY o&apos;rnatilmagan).</p>
          {counterpartPos ? (
            <p className="tabular-nums">
              {counterpartLabel}: {counterpartPos.latitude.toFixed(5)}, {counterpartPos.longitude.toFixed(5)}
            </p>
          ) : (
            <p>{counterpartLabel} joylashuvi hali kelmadi.</p>
          )}
        </div>
      )}
    </div>
  );
}
