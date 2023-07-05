import { ClassValidatorError } from './class-validator.types';

export const isClassValidatorError = (error: unknown): error is ClassValidatorError => {
  return typeof error === 'object' && error !== null && 'statusCode' in error && 'message' in error && 'error' in error;
};
