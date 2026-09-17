import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'beaconops-theme';
const VALID_THEMES = ['light', 'dark', 'system'];

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return VALID_THEMES.includes(stored) ? stored : 'system';
  } catch {
    // localStorage can throw in private-browsing/quota-exceeded situations.
    return 'system';
  }
}

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveTheme(theme) {
  return theme === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : theme;
}

/**
 * Manages the light/dark/system theme choice: persists it to localStorage,
 * resolves "system" against the OS preference, keeps that resolution live
 * while the OS preference changes, and reflects the resolved value onto
 * <html data-theme="..."> for the CSS theme tokens to key off.
 *
 * index.html also sets this attribute synchronously (inline script) before
 * React mounts, so there's no flash of the wrong theme on load — this hook
 * just takes over from there.
 */
export function useTheme() {
  const [theme, setThemeState] = useState(readStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState(() => resolveTheme(readStoredTheme()));

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (theme !== 'system') return undefined;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    function handleChange() {
      setResolvedTheme(media.matches ? 'dark' : 'light');
    }

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = useCallback((next) => {
    if (!VALID_THEMES.includes(next)) return;
    setThemeState(next);
    setResolvedTheme(resolveTheme(next));
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore write failures; the choice just won't persist this session.
    }
  }, []);

  return { theme, resolvedTheme, setTheme };
}
