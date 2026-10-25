'use client';

import { useEffect, useState, use } from 'react';
import { getDict } from '@/lib/dictionaries';
import { distanceKm } from '@/lib/geo';
import TabBar from '@/components/TabBar';
import ListingCard from '@/components/ListingCard';
import ListingMap from '@/components/ListingMap';
import Icon from '@/components/Icon';

// "Near me": no typing. The visitor taps one button, the phone asks for
// location permission, and homes sort nearest-first by real distance.
// Listings without coordinates can't be placed, so they don't appear here.
export default function NearMe(props) {
  const params = use(props.params);
  const t = getDict(params.locale);
  const [status, setStatus] = useState('idle'); // idle | locating | done | denied | unsupported
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]);
  const [radius, setRadius] = useState('all');

  useEffect(() => {
    fetch('/api/listings')
      .then((r) => r.json())
      .then((d) => setListings(d.listings))
      .catch(() => setListings([]));
  }, []);

  function locate() {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported');
      return;
    }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUser({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus('done');
      },
      () => setStatus('denied'),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  const placed = listings
    .filter((l) => typeof l.lat === 'number' && typeof l.lng === 'number')
    .map((l) => ({ ...l, km: user ? distanceKm(user.lat, user.lng, l.lat, l.lng) : null }))
    .sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
  const shown = radius === 'all' ? placed : placed.filter((l) => l.km <= Number(radius));
  const unplaced = listings.length - placed.length;

  return (
    <>
      <main className="container">
        <h1 className="page-title"><Icon name="pin" /> {t.nearMe}</h1>
        {status === 'idle' && (
          <>
            <p className="muted">{t.nearMeIntro}</p>
            <button className="btn" type="button" onClick={locate}>{t.useMyLocation}</button>
          </>
        )}
        {status === 'locating' && <p>{t.locating}</p>}
        {status === 'denied' && (
          <>
            <p>{t.locationDenied}</p>
            <button className="btn" type="button" onClick={locate}>{t.useMyLocation}</button>
          </>
        )}
        {status === 'unsupported' && <p>{t.locationUnsupported}</p>}
        {status === 'done' && user && (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              <label>{t.radius}: </label>
              <select className="input" value={radius} onChange={(e) => setRadius(e.target.value)} style={{ width: 'auto' }}>
                <option value="all">{t.radiusAll}</option>
                <option value="5">5 km</option>
                <option value="10">10 km</option>
                <option value="25">25 km</option>
                <option value="50">50 km</option>
              </select>
            </div>
            <ListingMap listings={shown} locale={params.locale} t={t} userLocation={user} />
            <p className="muted" style={{ marginTop: 16 }}>
              <strong>{shown.length}</strong> {t.resultsFound}
              {unplaced > 0 && <> · {t.unplacedNote}</>}
            </p>
            <div className="grid grid-2">
              {shown.map((l) => (
                <div key={l.id}>
                  <ListingCard listing={l} locale={params.locale} t={t} />
                  <p style={{ margin: '6px 0 0', fontWeight: 700 }}><Icon name="pin" /> {l.km < 1 ? `${Math.round(l.km * 1000)} m` : `${l.km.toFixed(1)} ${t.kmAway}`}</p>
                </div>
              ))}
            </div>
            {shown.length === 0 && <p>{t.noNearbyHomes}</p>}
          </>
        )}
      </main>
      <TabBar locale={params.locale} browse={t.browse} favorites={t.favorites} explore={t.explore} account={t.account} />
    </>
  );
}
