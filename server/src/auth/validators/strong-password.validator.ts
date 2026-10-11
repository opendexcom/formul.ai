import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export const PASSWORD_MIN_LENGTH = 8;

const HAS_UPPERCASE = /[A-Z]/;
const HAS_LOWERCASE = /[a-z]/;
const HAS_DIGIT = /\d/;
const HAS_SPECIAL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

const DEFAULT_MESSAGE =
  'Password must be at least 8 characters and contain an uppercase letter, a lowercase letter, a number, and a special character.';

function isStrongPassword(value: string): boolean {
  if (typeof value !== 'string' || value.length < PASSWORD_MIN_LENGTH) {
    return false;
  }
  return (
    HAS_UPPERCASE.test(value) &&
    HAS_LOWERCASE.test(value) &&
    HAS_DIGIT.test(value) &&
    HAS_SPECIAL.test(value)
  );
}

export { isStrongPassword };

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions ?? { message: DEFAULT_MESSAGE },
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          return typeof value === 'string' && isStrongPassword(value);
        },
      },
    });
  };
}
