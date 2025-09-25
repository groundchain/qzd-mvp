import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('Admin App', () => {
  it('lists system events', () => {
    render(<App />);
    expect(screen.getByText(/system-start/i)).toBeInTheDocument();
  });
});
