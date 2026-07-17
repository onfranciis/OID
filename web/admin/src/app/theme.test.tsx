import { act, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { ThemeProvider, useTheme } from './theme';

function stubMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  const media = {
    matches,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_event: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) =>
      listeners.delete(listener),
  };

  vi.spyOn(window, 'matchMedia').mockReturnValue(
    media as unknown as MediaQueryList,
  );

  return {
    triggerChange: (nextMatches: boolean) => {
      media.matches = nextMatches;
      listeners.forEach((listener) => listener());
    },
  };
}

function Probe() {
  const { preference, resolvedTheme, setPreference } = useTheme();

  return (
    <div>
      <span data-testid="preference">{preference}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={() => setPreference('light')}>light</button>
      <button onClick={() => setPreference('dark')}>dark</button>
      <button onClick={() => setPreference('system')}>system</button>
    </div>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

test('defaults to system and follows the OS preference when nothing is stored', () => {
  stubMatchMedia(true);

  const { getByTestId } = render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );

  expect(getByTestId('preference').textContent).toBe('system');
  expect(getByTestId('resolved').textContent).toBe('dark');
  expect(document.documentElement.classList.contains('dark')).toBe(true);
});

test('a stored preference overrides the system default', () => {
  stubMatchMedia(true);
  localStorage.setItem('oid-admin-theme', 'light');

  const { getByTestId } = render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );

  expect(getByTestId('preference').textContent).toBe('light');
  expect(getByTestId('resolved').textContent).toBe('light');
  expect(document.documentElement.classList.contains('dark')).toBe(false);
});

test('setPreference toggles the dark class and persists to localStorage', () => {
  stubMatchMedia(false);

  const { getByText, getByTestId } = render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );

  act(() => getByText('dark').click());

  expect(getByTestId('resolved').textContent).toBe('dark');
  expect(document.documentElement.classList.contains('dark')).toBe(true);
  expect(localStorage.getItem('oid-admin-theme')).toBe('dark');

  act(() => getByText('light').click());

  expect(document.documentElement.classList.contains('dark')).toBe(false);
  expect(localStorage.getItem('oid-admin-theme')).toBe('light');
});

test('switching back to system re-follows a live OS preference change', () => {
  const { triggerChange } = stubMatchMedia(false);

  const { getByRole, getByTestId } = render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );

  act(() => getByRole('button', { name: 'system' }).click());
  expect(getByTestId('resolved').textContent).toBe('light');

  act(() => triggerChange(true));
  expect(getByTestId('resolved').textContent).toBe('dark');
});
