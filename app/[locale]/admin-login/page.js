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
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      setError(t.invalidAdminPassword);
      return;
    }
    router.push(`/${params.locale}/admin`);
  }

  return (
    <>
      <main className="container">
        <BackButton locale={params.locale} />
        <h1>{t.adminLogin}</h1>
        <form className="card" onSubmit={submit}>
          <div className="card-body" style={{ display: 'grid', gap: 14 }}>
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
