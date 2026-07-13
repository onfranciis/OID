import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { App } from './App';

test('renders the admin shell brand', () => {
  render(<App />);

  expect(screen.getByText('Internal ID Admin')).toBeDefined();
});
