import { ValidateAtLeastOneRequired } from './at-least-one-required.validator';
import { IsArrayNotEmpty } from './is-array-not-empty.validator';
import { IsEmail } from './is-email.validator';
import { MustMatch } from './must-match.validator';

export * from './at-least-one-required.validator';
export * from './is-array-not-empty.validator';
export * from './is-email.validator';
export * from './must-match.validator';

export const Validators = {
  MustMatch,
  IsEmail,
  IsArrayNotEmpty,
  ValidateAtLeastOneRequired,
} as const;
