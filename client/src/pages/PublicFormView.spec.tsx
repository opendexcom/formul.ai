import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import PublicFormView from './PublicFormView';
import { QuestionType } from '../services/formsService';

const polishForm = {
  _id: 'form-pl',
  title: 'Ankieta satysfakcji',
  description: 'Creator-written description stays as-is',
  language: 'pl',
  isActive: true,
  isPublic: true,
  questions: [
    {
      id: 'q1',
      title: 'Jak oceniasz obsługę?',
      type: QuestionType.TEXT,
      required: true,
      canBeOther: false,
      order: 1,
    },
  ],
  settings: {
    allowMultipleResponses: true,
    requireLogin: false,
    showProgressBar: false,
  },
};

function renderPublicForm() {
  return render(
    <MemoryRouter initialEntries={['/form/form-pl']}>
      <Routes>
        <Route path="/form/:formId" element={<PublicFormView />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PublicFormView Polish respondent strings', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows Polish labels, required validation, and submits successfully', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => polishForm,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, responseId: 'r1' }),
      });

    renderPublicForm();

    expect(await screen.findByRole('button', { name: 'Wyślij' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('pl');
    expect(screen.getByText('Ankieta satysfakcji')).toBeInTheDocument();
    expect(screen.getByText('Creator-written description stays as-is')).toBeInTheDocument();
    expect(screen.getByText('Jak oceniasz obsługę?')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Wyślij' }));
    expect(await screen.findByText('To pole jest wymagane')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await userEvent.type(screen.getByPlaceholderText('Wpisz odpowiedź'), 'Bardzo dobrze');
    await userEvent.click(screen.getByRole('button', { name: 'Wyślij' }));

    expect(await screen.findByText('Dziękujemy!')).toBeInTheDocument();
    expect(screen.getByText('Twoja odpowiedź została pomyślnie przesłana.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const submitCall = fetchMock.mock.calls[1];
    expect(submitCall[0]).toContain('/public/forms/form-pl/responses');
    expect(submitCall[1].method).toBe('POST');
    expect(JSON.parse(submitCall[1].body).responses.q1).toBe('Bardzo dobrze');
  });
});
