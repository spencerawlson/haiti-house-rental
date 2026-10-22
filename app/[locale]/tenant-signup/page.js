'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { getDict } from '@/lib/dictionaries';
import { createAccount } from '@/lib/account';
import TabBar from '@/components/TabBar';
import BackButton from '@/components/BackButton';

// Tenant account: username + phone number + password, just like a landlord
// account — except free. No fee, no admin activation: active immediately.
export default function TenantSignup(props) {
  const params = use(props.params);
  const t = getDict(params.locale);
  const router = useRouter();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim() || !username.trim() || !password || !phone.trim()) {
      setError(t.requiredField);
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
    const result = await createAccount({
      name: name.trim(), username: username.trim(), password,
      phone: phone.trim(), email: '', location: null, role: 'tenant',
    });
    if (result.error === 'taken') {
      setError(t.usernameTaken);
      return;
    }
    if (result.error) {
      setError(t.requiredField);
      return;
    }
    router.push(`/${params.locale}/account`);
  }

  return (
    <>
      <main className="container">
        <BackButton locale={params.locale} />
        <h1>{t.createTenantAccount}</h1>
        <p className="muted">{t.tenantFree}</p>
        <form className="card" onSubmit={submit}>
          <div className="card-body" style={{ display: 'grid', gap: 14 }}>
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
            {error && <p style={{ color: '#dc2626', margin: 0 }}>{error}</p>}
            <button className="btn" type="submit">{t.createTenantAccount}</button>
          </div>
        </form>
      </main>
      <TabBar locale={params.locale} browse={t.browse} favorites={t.favorites} explore={t.explore} account={t.account} />
    </>
  );
}
