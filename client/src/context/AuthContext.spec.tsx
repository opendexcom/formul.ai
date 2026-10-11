import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

const loginMock = vi.fn();

vi.mock('../services/authService', () => ({
  default: {
    login: (...args: unknown[]) => loginMock(...args),
    register: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn(() => null),
    getCurrentUserId: vi.fn(() => null),
    isAuthenticated: vi.fn(() => false),
    updateStoredUser: vi.fn(),
  },
}));

const Probe: React.FC = () => {
  const { login, loading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <button
        type="button"
        onClick={() => {
          void login('user@example.com', 'secret').catch(() => undefined);
        }}
      >
        Sign In
      </button>
    </div>
  );
};

describe('AuthProvider login', () => {
  it('keeps auth loading false when login fails so the form stays mounted', async () => {
    loginMock.mockRejectedValueOnce(new Error('Invalid credentials'));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalled();
    });
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });
});
