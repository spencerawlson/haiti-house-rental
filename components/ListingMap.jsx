'use client';

import { useEffect, useRef } from 'react';

// Centris-style map view, powered by Leaflet + OpenStreetMap tiles
// (free, no key). Listings without coordinates don't get a pin.
export default function ListingMap({ listings, locale, perMonth }) {
  const divRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    function init(L) {
      if (cancelled || !divRef.current) return;
      if (mapRef.current) mapRef.current.remove();
      const map = L.map(divRef.current).setView([18.7, -72.7], 8);
      L.tileLayer('/api/tiles/{z}/{x}/{y}', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);
      const points = [];
      for (const l of listings) {
        if (typeof l.lat !== 'number' || typeof l.lng !== 'number') continue;
        points.push([l.lat, l.lng]);
        L.marker([l.lat, l.lng])
          .addTo(map)
          .bindPopup(
            `<strong>${l.priceHTG.toLocaleString()} HTG ${perMonth}</strong><br/>` +
            `<a href="/${locale}/listings/${l.id}">${l.title}</a><br/>${l.commune}`,
          );
      }
      if (points.length > 1) map.fitBounds(points, { padding: [30, 30] });
      else if (points.length === 1) map.setView(points[0], 12);
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
      }
    };
  }, [listings, locale, perMonth]);

  return <div ref={divRef} style={{ height: 480, width: '100%', borderRadius: 16, border: '1px solid #e7e2dc', zIndex: 0 }} />;
}
