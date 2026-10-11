import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import LandingPage from './LandingPage';

const loginMock = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    login: loginMock,
    register: vi.fn(),
  }),
}));

vi.mock('../plugins/PluginSlot', () => ({
  default: () => null,
}));

vi.mock('../plugins/usePluginSlot', () => ({
  usePluginSlot: () => ({
    slotActive: false,
    api: undefined,
    refresh: vi.fn(),
  }),
}));

vi.mock('../services/apiClient', () => ({
  apiClient: {
    getRegistrationSetting: vi.fn().mockResolvedValue({ allowRegistration: true }),
  },
}));

describe('LandingPage login errors', () => {
  it('shows the API error after a failed sign in', async () => {
    loginMock.mockRejectedValueOnce(new Error('Invalid credentials'));

    render(<LandingPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sign Up' })).toBeInTheDocument();
    });

    await userEvent.type(screen.getByLabelText('Email'), 'nobody@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'WrongPass1!');
    await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Email')).toHaveValue('nobody@example.com');
  });
});
