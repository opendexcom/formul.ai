import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { IsString } from 'class-validator';
import { IsStrongPassword, PASSWORD_MIN_LENGTH } from './strong-password.validator';

class TestDto {
  @IsString()
  @IsStrongPassword()
  password!: string;
}

describe('IsStrongPassword', () => {
  it('rejects empty string', async () => {
    const dto = plainToInstance(TestDto, { password: '' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('password');
    expect(errors[0].constraints?.isStrongPassword).toContain('8 characters');
  });

  it('rejects password shorter than 8 characters', async () => {
    const dto = plainToInstance(TestDto, { password: 'Ab1!' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.isStrongPassword).toBeDefined();
  });

  it('rejects password with only length 6 (legacy weak)', async () => {
    const dto = plainToInstance(TestDto, { password: 'abcdef' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });

  it('rejects password without uppercase', async () => {
    const dto = plainToInstance(TestDto, { password: 'securep@ss1' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.isStrongPassword).toContain('uppercase');
  });

  it('rejects password without lowercase', async () => {
    const dto = plainToInstance(TestDto, { password: 'SECUREP@SS1' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.isStrongPassword).toContain('lowercase');
  });

  it('rejects password without digit', async () => {
    const dto = plainToInstance(TestDto, { password: 'SecureP@ss' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.isStrongPassword).toContain('number');
  });

  it('rejects password without special character', async () => {
    const dto = plainToInstance(TestDto, { password: 'SecurePass1' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.isStrongPassword).toContain('special character');
  });

  it('accepts password meeting all rules', async () => {
    const dto = plainToInstance(TestDto, { password: 'SecureP@ss1' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts another valid strong password', async () => {
    const dto = plainToInstance(TestDto, { password: 'MyP@ssw0rd' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects non-string value', async () => {
    const dto = plainToInstance(TestDto, { password: 123 as any });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });
});

describe('PASSWORD_MIN_LENGTH', () => {
  it('is 8', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });
});
