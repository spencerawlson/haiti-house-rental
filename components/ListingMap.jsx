'use client';

import { useEffect, useRef } from 'react';

// Centris-style map view, powered by Leaflet + OpenStreetMap tiles
// (free, no key). Listings without coordinates don't get a pin. Clicking
// a price pin opens that listing directly — no popup in between.
export default function ListingMap({ listings, locale, t, userLocation, height = 480 }) {
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
      if (userLocation) {
        points.push([userLocation.lat, userLocation.lng]);
        L.circleMarker([userLocation.lat, userLocation.lng], {
          radius: 10, color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.9,
        }).addTo(map).bindPopup('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>');
      }
      // A tap on a price pin opens that listing straight away — no popup
      // in between, on this map or any other map in the app.
      const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
      // Public pins are APPROXIMATE (Stage 2, B1): the public shape
      // carries approxLat/approxLng, grid-snapped to ~440m cells
      // (lib/listings-server.js approxCoord), never the exact
      // coordinates. Two listings in the same cell land on the exact
      // same point — group by that shared coordinate and fan each
      // group out in a small circle around it, so every pin stays
      // independently tappable instead of stacking with only the
      // topmost one clickable. Spread is computed at a fixed reference
      // zoom (not the map's current/eventual zoom, which isn't settled
      // until fitBounds below) so the real-world spacing stays small
      // and predictable regardless of what the map ends up fitting to.
      const SPREAD_ZOOM = 15;
      const SPREAD_RADIUS_PX = 20;
      const groups = new Map();
      for (const l of listings) {
        if (typeof l.approxLat !== 'number' || typeof l.approxLng !== 'number') continue;
        const key = `${l.approxLat},${l.approxLng}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(l);
      }
      for (const group of groups.values()) {
        const [lat, lng] = [group[0].approxLat, group[0].approxLng];
        const center = group.length > 1 ? map.project([lat, lng], SPREAD_ZOOM) : null;
        group.forEach((l, i) => {
          let pinLat = lat;
          let pinLng = lng;
          if (center) {
            const angle = (2 * Math.PI * i) / group.length;
            const offset = L.point(Math.cos(angle) * SPREAD_RADIUS_PX, Math.sin(angle) * SPREAD_RADIUS_PX);
            const spread = map.unproject(center.add(offset), SPREAD_ZOOM);
            pinLat = spread.lat;
            pinLng = spread.lng;
          }
          points.push([pinLat, pinLng]);
          // Price pins (design screen 5): the rent/sale price on the map
          // itself, so people compare without opening every marker.
          const short = l.price >= 1000 ? `${Math.round(l.price / 1000).toLocaleString()}k` : String(l.price || 0);
          const marker = L.marker([pinLat, pinLng], {
            icon: L.divIcon({ className: '', html: `<span class="price-pin">${esc(short)} ${esc(l.currency || 'HTG')}</span>`, iconSize: null, iconAnchor: [30, 28] }),
          }).addTo(map);
          marker.on('click', () => { window.location.href = `/${locale}/listings/${encodeURIComponent(l.id)}`; });
        });
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
  }, [listings, locale, t, userLocation]);

  return <div ref={divRef} style={{ height, width: '100%', borderRadius: 16, border: '1px solid #e7e2dc', zIndex: 0 }} />;
}
