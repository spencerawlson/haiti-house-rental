'use client';

import { useEffect, useState, use } from 'react';
import { getDict } from '@/lib/dictionaries';
import AdminChatBox from '@/components/AdminChatBox';
import BackButton from '@/components/BackButton';

// One user's admin thread, opened from the Admin Board's thread list
// or the chat symbol on an account row. The data route is full-admin
// only, so a signed-out or stats visitor sees the sign-in prompt
// instead of any thread — the page shell itself carries no user data.
export default function AdminChats(props) {
  const params = use(props.params);
  const t = getDict(params.locale);
  const [username, setUsername] = useState('');

  useEffect(() => {
    setUsername(new URLSearchParams(window.location.search).get('username') || '');
  }, []);

  return (
    <main className="container admin">
      <BackButton locale={params.locale} />
      <h1 className="page-title">{t.adminChatTitle}{username ? ` · @${username}` : ''}</h1>
      {username && <AdminChatBox mode="admin" username={username} strings={t} locale={params.locale} />}
    </main>
  );
}
