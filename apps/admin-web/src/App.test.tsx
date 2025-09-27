import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('@qzd/sdk-browser', () => {
  class MockAdminApi {
    listIssuanceRequests = vi.fn().mockResolvedValue({ items: [] });
    signIssuanceRequest = vi.fn().mockResolvedValue({});
    createIssuanceRequest = vi.fn().mockResolvedValue({});
  }

  class MockAgentsApi {
    redeemVoucher = vi.fn().mockResolvedValue({
      code: 'vch_test',
      amount: { currency: 'QZD', value: '0.00' },
      fee: { currency: 'QZD', value: '0.00' },
      totalDebited: { currency: 'QZD', value: '0.00' },
      status: 'issued',
      createdAt: '2024-01-01T00:00:00Z',
    });
  }

  class MockConfiguration {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    constructor() {}
  }

  return { AdminApi: MockAdminApi, AgentsApi: MockAgentsApi, Configuration: MockConfiguration };
});

describe('Admin App', () => {
  it('renders the issuance queue layout', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: /issuance queue/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /connection/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /voucher redemption/i })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /create issuance request/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /validator actions/i })).toBeInTheDocument();
  });

  it('prefills connection defaults and validator identity', () => {
    render(<App />);

    expect(screen.getByPlaceholderText('http://localhost:3000')).toHaveValue('http://localhost:3000');
    expect(screen.getByPlaceholderText('Paste bearer token')).toHaveValue('');
    expect(screen.getByPlaceholderText('vch_000001')).toHaveValue('');
    expect(screen.getByRole('combobox', { name: /validator identity/i })).toHaveDisplayValue('validator-1');
  });

  it('shows empty issuance queue message by default', () => {
    render(<App />);

    expect(screen.getAllByText(/no issuance requests available/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/no voucher redeemed yet/i)).toBeInTheDocument();
  });
});
