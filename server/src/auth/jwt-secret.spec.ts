import {
  getJwtSecret,
  INSECURE_JWT_SECRET_DEFAULT,
  JWT_SECRET_ERROR,
} from './jwt-secret';

describe('getJwtSecret', () => {
  it('returns a configured secret', () => {
    expect(getJwtSecret({ JWT_SECRET: 'formulai-test-jwt-secret' })).toBe(
      'formulai-test-jwt-secret',
    );
  });

  it.each([
    ['missing', {}],
    ['empty', { JWT_SECRET: '' }],
    ['whitespace', { JWT_SECRET: '   ' }],
    ['legacy default', { JWT_SECRET: INSECURE_JWT_SECRET_DEFAULT }],
  ])('rejects %s JWT_SECRET', (_label, env) => {
    expect(() => getJwtSecret(env)).toThrow(JWT_SECRET_ERROR);
  });
});
