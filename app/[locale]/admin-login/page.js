'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { getDict } from '@/lib/dictionaries';
import TabBar from '@/components/TabBar';
import BackButton from '@/components/BackButton';

// Admin login. The password is set in the server env (ADMIN_PASSWORD) and
// is never in the code or the repo.
export default function AdminLogin(props) {
  const params = use(props.params);
  const t = getDict(params.locale);
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password }),
    });
    if (!res.ok) {
      setError(t.invalidAdminPassword);
      return;
    }
    const data = await res.json().catch(() => ({}));
    router.push(`/${params.locale}/${data.scope === 'stats' ? 'stats' : 'admin'}`);
  }

  return (
    <>
      <main className="container">
        <BackButton locale={params.locale} />
        <h1 className="page-title">{t.adminLogin}</h1>
        <form className="card" onSubmit={submit}>
          <div className="card-body" style={{ display: 'grid', gap: 14 }}>
            <p className="muted" style={{ margin: 0 }}>{t.adminLoginScopeNote}</p>
            <div className="field"><label>{t.username}</label>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            </div>
            <div className="field"><label>{t.adminPassword}</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p style={{ color: '#dc2626', margin: 0 }}>{error}</p>}
            <button className="btn" type="submit">{t.adminLogin}</button>
          </div>
        </form>
      </main>
      <TabBar locale={params.locale} browse={t.browse} favorites={t.favorites} explore={t.explore} account={t.account} />
    </>
  );
}
