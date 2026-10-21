'use client';

import { useEffect, useState } from 'react';
import { getStoredTheme, applyTheme } from '@/lib/theme';

// Light / dark switch. Reads the theme the layout script applied, so the
// buttons always show the theme actually in use.
export default function ThemeToggle({ lightLabel, darkLabel }) {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme || getStoredTheme() || 'light');
  }, []);

  function pick(next) {
    applyTheme(next);
    setTheme(next);
  }

  return (
    <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button
        className={theme === 'light' ? 'btn' : 'btn btn-secondary'}
        type="button"
        onClick={() => pick('light')}
        style={{ minHeight: 40, padding: '8px 16px' }}
      >
        ☀️ {lightLabel}
      </button>
      <button
        className={theme === 'dark' ? 'btn' : 'btn btn-secondary'}
        type="button"
        onClick={() => pick('dark')}
        style={{ minHeight: 40, padding: '8px 16px' }}
      >
        🌙 {darkLabel}
      </button>
    </span>
  );
}
