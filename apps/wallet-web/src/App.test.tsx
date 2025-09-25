import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders health status once loaded', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({ status: 'ok', uptime: 1 })
    } as Response);

    render(<App />);

    await waitFor(() => expect(screen.getByText(/API is ok/i)).toBeInTheDocument());
    fetchMock.mockRestore();
  });
});
