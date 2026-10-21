'use client';

import { useRouter } from 'next/navigation';
import { getDict } from '@/lib/dictionaries';

// App-style back arrow: returns to the screen the user came from. The tab
// bar can't do that — it jumps to a destination instead. Falls back to
// the home screen when there is no previous screen (fresh tab, deep link).
export default function BackButton({ locale }) {
  const router = useRouter();
  const t = getDict(locale);
  function goBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/${locale}`);
    }
  }
  return (
    <button
      type="button"
      onClick={goBack}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--primary)', fontWeight: 700, fontSize: '1rem',
        padding: '4px 0', marginBottom: 8,
      }}
    >
      ← {t.back}
    </button>
  );
}
