import {
  PUBLIC_FORM_ALLOWED_KEYS,
  PUBLIC_FORM_REQUIRED_KEYS,
  PUBLIC_QUESTION_ALLOWED_KEYS,
  PUBLIC_SETTINGS_ALLOWED_KEYS,
  toPublicFormDto,
} from './public-form.dto';

describe('toPublicFormDto', () => {
  const ownerId = '64b0c0c0c0c0c0c0c0c0c0c0';
  const leakedQuote = 'Other respondent said this privately';

  const leanForm = {
    _id: ownerId.replace(/c0c0c0c0c0c0c0c0c0c0c0c0/, 'aaaaaaaaaaaaaaaaaaaaaaaa'),
    title: 'Customer feedback',
    description: 'Tell us what you think',
    createdBy: ownerId,
    owner: { email: 'owner@example.com', id: ownerId },
    invitations: [{ email: 'invitee@example.com', token: 'secret-token' }],
    collaborators: [{ email: 'collab@example.com' }],
    analytics: {
      representativeQuotes: [leakedQuote],
      quotes: { representative: [{ text: leakedQuote, responseId: 'r1' }] },
    },
    statistics: { totalResponses: 42 },
    projectId: '64b0aaaaaaaaaaaaaaaaaaaa',
    variantKey: 'main',
    isPublic: true,
    isActive: true,
    analyticsLock: 'task-1',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    __v: 3,
    questions: [
      {
        id: 'q1',
        title: 'How was it?',
        description: 'Be honest',
        type: 'textarea',
        required: true,
        canBeOther: false,
        options: ['Good', 'Bad'],
        order: 1,
        validation: { minLength: { value: 3 } },
        reverseCoded: true,
        pairedQuestionId: 'q0',
        internalNote: 'do not leak',
      },
    ],
    settings: {
      allowMultipleResponses: false,
      requireLogin: true,
      showProgressBar: true,
      customTheme: {
        primaryColor: '#111111',
        backgroundColor: '#ffffff',
        fontFamily: 'Inter',
        secretToken: 'nope',
      },
      webhookUrl: 'https://internal.example.com/hook',
    },
    language: 'pl',
  };

  it('maps only the public allowlist and drops internal / PII fields', () => {
    const dto = toPublicFormDto(leanForm);

    expect(Object.keys(dto).sort()).toEqual([...PUBLIC_FORM_ALLOWED_KEYS].sort());
    expect(dto).toEqual({
      id: String(leanForm._id),
      title: 'Customer feedback',
      description: 'Tell us what you think',
      language: 'pl',
      questions: [
        {
          id: 'q1',
          title: 'How was it?',
          description: 'Be honest',
          type: 'textarea',
          required: true,
          canBeOther: false,
          options: ['Good', 'Bad'],
          order: 1,
          validation: { minLength: { value: 3 } },
        },
      ],
      settings: {
        allowMultipleResponses: false,
        requireLogin: true,
        showProgressBar: true,
        customTheme: {
          primaryColor: '#111111',
          backgroundColor: '#ffffff',
          fontFamily: 'Inter',
        },
      },
    });

    const serialized = JSON.stringify(dto);
    expect(serialized).not.toContain('analytics');
    expect(serialized).not.toContain(leakedQuote);
    expect(serialized).not.toContain('owner@example.com');
    expect(serialized).not.toContain('invitee@example.com');
    expect(serialized).not.toContain('createdBy');
    expect(serialized).not.toContain('invitations');
    expect(serialized).not.toContain('collaborators');
    expect(serialized).not.toContain('reverseCoded');
    expect(serialized).not.toContain('webhookUrl');
  });

  it('defaults language to en-US when it is not on the document', () => {
    const { language: _language, ...withoutLanguage } = leanForm;
    const dto = toPublicFormDto(withoutLanguage);

    expect(Object.keys(dto).sort()).toEqual([...PUBLIC_FORM_REQUIRED_KEYS].sort());
    expect(dto.language).toBe('en-US');
  });

  it('keeps the creator-chosen language and rejects unknown codes', () => {
    expect(toPublicFormDto({ ...leanForm, language: 'de' }).language).toBe('de');
    expect(toPublicFormDto({ ...leanForm, language: 'fr-FR' }).language).toBe('en-US');
  });

  it('locks question and settings keys to their allowlists', () => {
    const dto = toPublicFormDto(leanForm);
    const questionKeys = Object.keys(dto.questions[0]).sort();
    const settingsKeys = Object.keys(dto.settings).sort();

    expect(questionKeys.every((key) => PUBLIC_QUESTION_ALLOWED_KEYS.includes(key as any))).toBe(
      true,
    );
    expect(settingsKeys.every((key) => PUBLIC_SETTINGS_ALLOWED_KEYS.includes(key as any))).toBe(
      true,
    );
    expect(questionKeys).not.toContain('reverseCoded');
    expect(questionKeys).not.toContain('pairedQuestionId');
    expect(settingsKeys).not.toContain('webhookUrl');
  });
});
