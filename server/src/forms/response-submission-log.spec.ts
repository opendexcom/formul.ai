import {
  buildResponseSubmissionLogMeta,
  serializeLogArgs,
} from './response-submission-log';

describe('response-submission-log', () => {
  it('includes only non-identifying metadata', () => {
    const meta = buildResponseSubmissionLogMeta({
      formId: 'form-1',
      responseId: 'resp-1',
      answerCount: 3,
      durationMs: 12,
    });

    expect(meta).toEqual({
      formId: 'form-1',
      responseId: 'resp-1',
      answerCount: 3,
      durationMs: 12,
    });
    expect(meta).not.toHaveProperty('responses');
    expect(meta).not.toHaveProperty('answers');
    expect(meta).not.toHaveProperty('respondentEmail');
    expect(meta).not.toHaveProperty('ipAddress');
    expect(meta).not.toHaveProperty('userAgent');
  });
});

describe('serializeLogArgs', () => {
  it('flattens console arguments for assertions', () => {
    expect(serializeLogArgs(['Submitting response', { formId: 'f1', answerCount: 1 }])).toBe(
      'Submitting response {"formId":"f1","answerCount":1}',
    );
  });
});
