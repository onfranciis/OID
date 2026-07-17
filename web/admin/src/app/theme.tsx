import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'oid-admin-theme';
const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider.');
  }

  return context;
}

function readStoredPreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY);

  return stored === 'light' || stored === 'dark' || stored === 'system'
    ? stored
    : 'system';
}

function systemPrefersDark(): boolean {
  return window.matchMedia(DARK_MEDIA_QUERY).matches;
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system'
    ? systemPrefersDark()
      ? 'dark'
      : 'light'
    : preference;
}

// Persisted light/dark/system preference for the admin console (FRONTEND
// dark mode). The `.dark` class it applies to <html> is what every Tailwind
// color token in theme.css repaints against; index.html's inline bootstrap
// script mirrors this resolution before first paint to avoid a flash.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] =
    useState<ThemePreference>(readStoredPreference);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(preference),
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, [resolvedTheme]);

  useEffect(() => {
    setResolvedTheme(resolveTheme(preference));

    if (preference !== 'system') {
      return;
    }

    const media = window.matchMedia(DARK_MEDIA_QUERY);
    const handleChange = () => setResolvedTheme(resolveTheme('system'));

    media.addEventListener('change', handleChange);

    return () => media.removeEventListener('change', handleChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    localStorage.setItem(STORAGE_KEY, next);
    setPreferenceState(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, resolvedTheme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}
