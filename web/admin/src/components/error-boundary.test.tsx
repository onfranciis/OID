import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ErrorBoundary } from './error-boundary';

function Boom(): never {
  throw new Error('kaboom');
}

test('error boundary renders a safe fallback and hides the error detail', () => {
  // Suppress React's expected error logging for this render.
  const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

  render(
    <ErrorBoundary>
      <Boom />
    </ErrorBoundary>,
  );

  expect(screen.getByText('Something went wrong')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Reload' })).toBeDefined();
  // The raw error message is never shown to the user.
  expect(screen.queryByText(/kaboom/)).toBeNull();

  spy.mockRestore();
});

test('error boundary renders children when nothing throws', () => {
  render(
    <ErrorBoundary>
      <p>All good</p>
    </ErrorBoundary>,
  );

  expect(screen.getByText('All good')).toBeDefined();
  expect(screen.queryByText('Something went wrong')).toBeNull();
});
