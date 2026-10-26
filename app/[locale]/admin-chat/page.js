'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { getDict } from '@/lib/dictionaries';
import { getSession } from '@/lib/account';
import AdminChatBox from '@/components/AdminChatBox';
import BackButton from '@/components/BackButton';
import TabBar from '@/components/TabBar';

// The user's admin thread ("Contact admin" from the portal and the
// home page). Guests land on sign-in instead: the thread belongs to
// a signed-in account, and there is nothing useful to show without one.
export default function AdminChat(props) {
  const params = use(props.params);
  const t = getDict(params.locale);
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getSession()) {
      router.push(`/${params.locale}/signin`);
      return;
    }
    setReady(true);
  }, [router, params.locale]);

  return (
    <main className="container">
      <BackButton locale={params.locale} />
      <h1 className="page-title">{t.adminChatTitle}</h1>
      {ready && <AdminChatBox mode="user" strings={t} locale={params.locale} />}
      <TabBar locale={params.locale} t={t} />
    </main>
  );
}
