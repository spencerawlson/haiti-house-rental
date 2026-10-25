'use client';

import { useEffect, useRef, useState } from 'react';

// Tap-to-place map pin for posting or editing a listing. The landlord
// taps the map (or drags the pin) to put the marker on the home's exact
// spot; the coordinates go back to the form, which sends them with the
// listing. No pin placed means value is null, and the server falls back
// to geocoding the commune center, exactly as before.
const PIN_HTML = `<svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path fill="#dc2626" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="2.5" fill="#fff"/></svg>`;

export default function LocationPicker({ value, onChange, useMyLocationLabel, unavailableLabel }) {
  const divRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [locError, setLocError] = useState(false);

  function syncMarker(L, latlng) {
    if (!mapRef.current) return;
    if (markerRef.current) {
      markerRef.current.setLatLng(latlng);
    } else {
      markerRef.current = L.marker(latlng, {
        draggable: true,
        icon: L.divIcon({ className: '', html: PIN_HTML, iconSize: [34, 34], iconAnchor: [17, 34] }),
      }).addTo(mapRef.current);
      markerRef.current.on('dragend', () => {
        const ll = markerRef.current.getLatLng();
        onChangeRef.current({ lat: ll.lat, lng: ll.lng });
      });
    }
  }

  // Latest value wins once the map exists (the edit form loads its
  // listing after mount, so the pin often arrives after the map).
  useEffect(() => {
    valueRef.current = value;
    if (mapRef.current && value && typeof window !== 'undefined' && window.L) {
      syncMarker(window.L, [value.lat, value.lng]);
    }
  }, [value]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    function init(L) {
      if (cancelled || !divRef.current) return;
      if (mapRef.current) mapRef.current.remove();
      const start = valueRef.current;
      const map = L.map(divRef.current).setView(
        start ? [start.lat, start.lng] : [18.7, -72.7],
        start ? 14 : 8,
      );
      L.tileLayer('/api/tiles/{z}/{x}/{y}', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);
      map.on('click', (e) => {
        syncMarker(L, e.latlng);
        onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
      if (start) syncMarker(L, [start.lat, start.lng]);
      mapRef.current = map;
    }

    if (window.L) {
      init(window.L);
    } else {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/leaflet/leaflet.css';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = '/leaflet/leaflet.js';
      script.onload = () => init(window.L);
      document.body.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  function useMyLocation() {
    setLocError(false);
    if (!navigator.geolocation) {
      setLocError(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const ll = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (mapRef.current && window.L) {
          mapRef.current.setView([ll.lat, ll.lng], 15);
          syncMarker(window.L, [ll.lat, ll.lng]);
        }
        onChangeRef.current(ll);
      },
      () => setLocError(true),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div>
      <p style={{ margin: '0 0 8px' }}>
        <button type="button" className="btn btn-secondary" onClick={useMyLocation}>
          {useMyLocationLabel}
        </button>
      </p>
      <div ref={divRef} style={{ height: 320, width: '100%', borderRadius: 16, border: '1px solid #e7e2dc', zIndex: 0 }} />
      {locError && <p className="muted" style={{ margin: '6px 0 0' }}>{unavailableLabel}</p>}
      {value && (
        <p className="muted" style={{ margin: '6px 0 0' }}>
          {Number(value.lat).toFixed(5)}, {Number(value.lng).toFixed(5)}
        </p>
      )}
    </div>
  );
}
