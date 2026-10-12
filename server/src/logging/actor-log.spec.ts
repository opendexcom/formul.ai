import { actorUserId, logFormRequest, serializeLogArgs } from './actor-log';

describe('actorUserId', () => {
  it('prefers _id over id', () => {
    expect(actorUserId({ _id: 'abc', id: 'ignored' })).toBe('abc');
    expect(actorUserId({ id: 'xyz' })).toBe('xyz');
    expect(actorUserId({})).toBe('unknown');
    expect(actorUserId(undefined)).toBe('unknown');
  });
});

describe('logFormRequest', () => {
  it('form create/update logs contain userId and no email', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const secretEmail = 'owner@example.com';
    const user = { _id: 'user-123', email: secretEmail };

    try {
      logFormRequest('CREATE FORM REQUEST', user);
      logFormRequest('UPDATE FORM REQUEST', user, { formId: 'form-1' });

      const logs = logSpy.mock.calls.map((args) => serializeLogArgs(args)).join('\n');
      expect(logs).not.toContain(secretEmail);
      expect(logs).not.toContain('email');
      expect(logs).toContain('user-123');
      expect(logs).toContain('form-1');
      expect(logs).toContain('CREATE FORM REQUEST');
      expect(logs).toContain('UPDATE FORM REQUEST');
    } finally {
      logSpy.mockRestore();
    }
  });
});
