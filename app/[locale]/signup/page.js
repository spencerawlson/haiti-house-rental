'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getDict } from '@/lib/dictionaries';
import { DEPARTMENTS, departmentName } from '@/lib/departments';
import { ACTIVATION_FEE_HTG } from '@/lib/config';
import { createAccount, markMyTransferSent } from '@/lib/account';
import TabBar from '@/components/TabBar';
import BackButton from '@/components/BackButton';

// Account creation, in Spencer's order: identity first, then location.
// Step 1: full name, username, password, phone, email.
// Step 2: location — phone GPS (reverse-geocoded) or manual pick.
export default function Signup({ params }) {
  const t = getDict(params.locale);
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('ouest');
  const [commune, setCommune] = useState('');
  const [coords, setCoords] = useState(null);
  const [detected, setDetected] = useState('');
  const [locating, setLocating] = useState(false);
  const [provider, setProvider] = useState('moncash');
  const [destination, setDestination] = useState({ moncashNumber: '', natcashNumber: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then(setDestination).catch(() => {});
  }, []);

  function next() {
    setError('');
    if (!name.trim() || !username.trim() || !password || !phone.trim() || !email.trim()) {
      setError(t.requiredField);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t.invalidEmail);
      return;
    }
    if (password.length < 8) {
      setError(t.passwordTooShort);
      return;
    }
    if (phone.replace(/\D/g, '').length < 8) {
      setError(t.phoneInvalid);
      return;
    }
    if (!/^[a-zA-Z0-9._-]{3,}$/.test(username)) {
      setError(t.usernameInvalid);
      return;
    }
    setStep(2);
  }

  function detect() {
    if (!('geolocation' in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        try {
          const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
          const data = await res.json();
          if (data.commune) {
            setCommune(data.commune);
            setDetected(data.commune);
            const match = DEPARTMENTS.find((d) => d.id === (data.department || '').toLowerCase());
            if (match) setDepartment(match.id);
          }
        } catch {
          // manual fallback below
        }
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!commune.trim()) {
      setError(t.requiredField);
      return;
    }
    const result = await createAccount({
      name: name.trim(),
      username: username.trim(),
      password,
      phone: phone.trim(),
      email: email.trim(),
      location: { commune: commune.trim(), department, lat: coords?.lat ?? null, lng: coords?.lng ?? null },
    });
    if (result.error === 'taken') {
      setError(t.usernameTaken);
      return;
    }
    if (result.error) {
      setError(t.requiredField);
      return;
    }
    setStep(3);
  }

  async function sentTransfer() {
    await markMyTransferSent(provider);
    router.push(`/${params.locale}/account`);
  }

  const communes = DEPARTMENTS.find((d) => d.id === department)?.communes || [];

  return (
    <>
      <main className="container">
        <BackButton locale={params.locale} />
        <h1>{t.createAccount}</h1>
        <p>
          <Link href={`/${params.locale}/tenants`}>{t.tenantLink}</Link>
        </p>
        {step === 1 && (
          <form className="card" onSubmit={(e) => { e.preventDefault(); next(); }}>
            <div className="card-body" style={{ display: 'grid', gap: 14 }}>
              <h2 style={{ margin: 0 }}>{t.stepIdentity}</h2>
              <div className="field"><label>{t.fullName}</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="field"><label>{t.username}</label>
                <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <div className="field"><label>{t.password}</label>
                <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="field"><label>{t.phoneNumber}</label>
                <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+509 ____ ____" required />
              </div>
              <div className="field"><label>{t.email}</label>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              {error && <p style={{ color: '#dc2626' }}>{error}</p>}
              <button className="btn" type="submit">{t.location} →</button>
            </div>
          </form>
        )}
        {step === 2 && (
          <form className="card" onSubmit={submit}>
            <div className="card-body" style={{ display: 'grid', gap: 14 }}>
              <h2 style={{ margin: 0 }}>{t.stepLocation}</h2>
              <button className="btn btn-secondary" type="button" onClick={detect} disabled={locating}>
                {locating ? t.locating : `📍 ${t.detectLocation}`}
              </button>
              {detected && <p>{t.detectedLocation} <strong>{detected}</strong></p>}
              <p className="muted" style={{ margin: 0 }}>{t.manualLocation}</p>
              <div className="field"><label>{t.department}</label>
                <select className="input" value={department} onChange={(e) => setDepartment(e.target.value)}>
                  {DEPARTMENTS.map((d) => (
                    <option key={d.id} value={d.id}>{departmentName(d.id, params.locale)}</option>
                  ))}
                </select>
              </div>
              <div className="field"><label>{t.commune}</label>
                <select className="input" value={commune} onChange={(e) => setCommune(e.target.value)} required>
                  <option value="">{t.commune}</option>
                  {communes.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              {error && <p style={{ color: '#dc2626' }}>{error}</p>}
              <button className="btn" type="submit">{t.createAccountBtn}</button>
              <button className="btn btn-secondary" type="button" onClick={() => setStep(1)}>← {t.back}</button>
            </div>
          </form>
        )}
        {step === 3 && (
          <div className="card">
            <div className="card-body" style={{ display: 'grid', gap: 14 }}>
              <h2 style={{ margin: 0 }}>{t.activationStep}</h2>
              <p>{t.accountCreated}</p>
              <p>{t.sendTransfer}</p>
              <p style={{ fontSize: '1.2rem' }}>
                <strong>{ACTIVATION_FEE_HTG} HTG</strong>
              </p>
              <div style={{ display: 'flex', gap: 16 }}>
                <label>
                  <input type="radio" checked={provider === 'moncash'} onChange={() => setProvider('moncash')} /> MonCash
                </label>
                <label>
                  <input type="radio" checked={provider === 'natcash'} onChange={() => setProvider('natcash')} /> NatCash
                </label>
              </div>
              <p>{t.sendTo} <strong>{provider === 'natcash' ? (destination.natcashNumber || t.numberNotSet) : (destination.moncashNumber || t.numberNotSet)}</strong></p>
              <p>{t.fromYourNumber} {phone}</p>
              <p className="muted" style={{ margin: 0 }}>{t.transferNote}</p>
              <button className="btn" type="button" onClick={sentTransfer}>{t.transferSent}</button>
            </div>
          </div>
        )}
      </main>
      <TabBar locale={params.locale} browse={t.browse} favorites={t.favorites} explore={t.explore} account={t.account} />
    </>
  );
}
