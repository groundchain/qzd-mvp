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
    expect(screen.getByRole('heading', { level: 2, name: /account tools/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /send transfer/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /preview quote/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /redeem offline voucher/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /sign in to send transfers/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /sign in to preview quotes/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /sign in to redeem vouchers/i })).toBeInTheDocument();
  });
});
