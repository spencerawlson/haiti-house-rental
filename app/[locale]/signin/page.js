'use client';

import Link from 'next/link';
import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { getDict } from '@/lib/dictionaries';
import { signIn } from '@/lib/account';
import TabBar from '@/components/TabBar';
import BackButton from '@/components/BackButton';

// Sign-in for returning users, on any device. Username + password; the
// password is hashed in the browser before it leaves the device.
export default function SignIn(props) {
  const params = use(props.params);
  const t = getDict(params.locale);
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    const result = await signIn(username.trim(), password);
    if (result.error) {
      setError(t.invalidLogin);
      return;
    }
    router.push(`/${params.locale}/account`);
  }

  return (
    <>
      <main className="container">
        <BackButton locale={params.locale} />
        <h1>{t.signIn}</h1>
        <p>
          <Link href={`/${params.locale}/tenants`}>{t.tenantLink}</Link>
        </p>
        <form className="card" onSubmit={submit}>
          <div className="card-body" style={{ display: 'grid', gap: 14 }}>
            <div className="field"><label>{t.username}</label>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div className="field"><label>{t.password}</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p style={{ color: '#dc2626', margin: 0 }}>{error}</p>}
            <button className="btn" type="submit">{t.signIn}</button>
            <p style={{ margin: 0 }}>
              <Link href={`/${params.locale}/forgot-password`}>{t.forgotPassword}</Link>
            </p>
          </div>
        </form>
      </main>
      <TabBar locale={params.locale} browse={t.browse} favorites={t.favorites} explore={t.explore} account={t.account} />
    </>
  );
}
