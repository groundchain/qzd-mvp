import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('@qzd/sdk-browser', () => {
  class MockAdminApi {
    listIssuanceRequests = vi.fn().mockResolvedValue({ items: [] });
    signIssuanceRequest = vi.fn().mockResolvedValue({});
    createIssuanceRequest = vi.fn().mockResolvedValue({});
  }

  class MockConfiguration {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    constructor() {}
  }

  return { AdminApi: MockAdminApi, Configuration: MockConfiguration };
});

describe('Admin App', () => {
  it('renders the issuance queue layout', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: /issuance queue/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /connection/i })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /create issuance request/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /validator actions/i })).toBeInTheDocument();
  });

  it('prefills connection defaults and validator identity', () => {
    render(<App />);

    expect(screen.getByPlaceholderText('http://localhost:3000')).toHaveValue('http://localhost:3000');
    expect(screen.getByPlaceholderText('Paste bearer token')).toHaveValue('');
    expect(screen.getByRole('combobox', { name: /validator identity/i })).toHaveDisplayValue('validator-1');
  });

  it('shows empty issuance queue message by default', () => {
    render(<App />);

    expect(screen.getAllByText(/no issuance requests available/i)[0]).toBeInTheDocument();
  });
});
