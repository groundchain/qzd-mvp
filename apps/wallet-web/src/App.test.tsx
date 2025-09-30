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

  it('renders authentication first', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /qzd wallet/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /register \/ log in/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /load account/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /send transfer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /preview quote/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /redeem offline voucher/i }),
    ).not.toBeInTheDocument();
  });
});
