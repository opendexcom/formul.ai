import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import PublicFormView from './PublicFormView';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ formId: 'public-form-1' }),
    useNavigate: () => navigateMock,
  };
});

const publicFormPayload = {
  id: 'public-form-1',
  title: 'Whitelisted public form',
  description: 'Only respondent-safe fields',
  questions: [
    {
      id: 'q1',
      title: 'How was the event?',
      description: 'One sentence is enough',
      type: 'textarea',
      required: true,
      order: 1,
    },
    {
      id: 'q2',
      title: 'Overall rating',
      type: 'rating',
      required: false,
      order: 2,
      validation: { min: { value: 1 }, max: { value: 5 } },
    },
  ],
  settings: {
    allowMultipleResponses: true,
    requireLogin: false,
    showProgressBar: true,
    customTheme: {
      primaryColor: '#2563EB',
      backgroundColor: '#F9FAFB',
      fontFamily: 'Inter',
    },
  },
};

describe('PublicFormView reduced public payload', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => publicFormPayload,
      }),
    );
  });

  it('renders title, description, questions, and theme from the allowlisted payload', async () => {
    render(<PublicFormView />);

    await waitFor(() => {
      expect(screen.getByText('Whitelisted public form')).toBeInTheDocument();
    });

    expect(screen.getByText('Only respondent-safe fields')).toBeInTheDocument();
    expect(screen.getByText('How was the event?')).toBeInTheDocument();
    expect(screen.getByText('One sentence is enough')).toBeInTheDocument();
    expect(screen.getByText('Overall rating')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/public\/forms\/public-form-1$/),
    );
  });
});
