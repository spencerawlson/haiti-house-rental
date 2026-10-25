'use client';

import { useEffect, useRef } from 'react';
import { rentPeriodLabel } from '@/lib/listings';
import { communeName } from '@/lib/departments';

// Centris-style map view, powered by Leaflet + OpenStreetMap tiles
// (free, no key). Listings without coordinates don't get a pin.
export default function ListingMap({ listings, locale, t, userLocation }) {
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
      // Popups are raw HTML: every listing value is escaped, or a landlord
      // could put a script in a title and run it for every map visitor.
      const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
      for (const l of listings) {
        if (typeof l.lat !== 'number' || typeof l.lng !== 'number') continue;
        points.push([l.lat, l.lng]);
        // Price pins (design screen 5): the rent/sale price on the map
        // itself, so people compare without opening every marker.
        const short = l.priceHTG >= 1000 ? `${Math.round(l.priceHTG / 1000).toLocaleString()}k` : String(l.priceHTG || 0);
        L.marker([l.lat, l.lng], {
          icon: L.divIcon({ className: '', html: `<span class="price-pin">${esc(short)} HTG</span>`, iconSize: null, iconAnchor: [30, 28] }),
        })
          .addTo(map)
          .bindPopup(
            `<strong>${esc(Number(l.priceHTG || 0).toLocaleString())} HTG${l.purpose === 'rent' ? ` ${esc(rentPeriodLabel(l.rentPeriod, t))}` : ''}</strong><br/>` +
            `<a href="/${esc(locale)}/listings/${encodeURIComponent(l.id)}">${esc(l.title)}</a><br/>${esc(communeName(l.commune, locale))}`,
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
  }, [listings, locale, t, userLocation]);

  return <div ref={divRef} style={{ height: 480, width: '100%', borderRadius: 16, border: '1px solid #e7e2dc', zIndex: 0 }} />;
}
