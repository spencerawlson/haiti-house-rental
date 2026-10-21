// Theme preference: 'light' or 'dark', stored locally. The root layout
// runs a no-flash script that applies the stored choice (or the system
// preference when nothing is stored) before first paint; this helper
// keeps the toggle in sync with it.
export const THEME_KEY = 'kay_theme';

export function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
}
