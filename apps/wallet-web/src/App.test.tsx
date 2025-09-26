import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '',
      headers: new Headers(),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders core wallet flows', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /qzd wallet/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /authentication/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /send transfer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /preview quote/i })).toBeInTheDocument();
  });
});
