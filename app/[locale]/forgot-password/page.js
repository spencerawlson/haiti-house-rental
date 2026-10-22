'use client';

import Link from 'next/link';
import { useState } from 'react';
import { getDict } from '@/lib/dictionaries';
import { hashPassword } from '@/lib/account';
import TabBar from '@/components/TabBar';
import BackButton from '@/components/BackButton';

// Forgot password: the user contacts Kay Ayiti, the admin confirms who
// they are and gives a one-time reset code (24h), and the user sets a new
// password here with username + code. No email needed — many accounts
// have none. (Username + phone alone used to be enough: unsafe.)
export default function ForgotPassword({ params }) {
  const t = getDict(params.locale);
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError(t.passwordMismatch);
      return;
    }
    const res = await fetch('/api/password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), code, passwordHash: await hashPassword(password) }),
    });
    if (!res.ok) {
      setError(t.resetFailed);
      return;
    }
    setDone(true);
  }

  return (
    <>
      <main className="container">
        <BackButton locale={params.locale} />
        <h1>{t.resetPassword}</h1>
        {done ? (
          <div className="card">
            <div className="card-body">
              <p style={{ margin: '0 0 12px' }}>✓ {t.resetSuccess}</p>
              <Link className="btn" href={`/${params.locale}/signin`}>{t.signIn}</Link>
            </div>
          </div>
        ) : (
          <form className="card" onSubmit={submit}>
            <div className="card-body" style={{ display: 'grid', gap: 14 }}>
              <p className="muted" style={{ margin: 0 }}>{t.resetCodeHelp}</p>
              <div className="field"><label>{t.username}</label>
                <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <div className="field"><label>{t.resetCodeLabel}</label>
                <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXXX-XXXXX" autoCapitalize="characters" autoComplete="one-time-code" required />
              </div>
              <div className="field"><label>{t.newPassword}</label>
                <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="field"><label>{t.confirmPassword}</label>
                <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </div>
              {error && <p style={{ color: '#dc2626', margin: 0 }}>{error}</p>}
              <button className="btn" type="submit">{t.resetPassword}</button>
            </div>
          </form>
        )}
      </main>
      <TabBar locale={params.locale} browse={t.browse} favorites={t.favorites} explore={t.explore} account={t.account} />
    </>
  );
}
