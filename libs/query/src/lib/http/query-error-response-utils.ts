import { FormViolationListView, FormViolationView } from '@ethlete/types';

export interface ClassValidatorError {
  statusCode: number;
  message: string[];
  error: string;
}

export const isClassValidatorError = (error: unknown): error is ClassValidatorError => {
  return typeof error === 'object' && error !== null && 'statusCode' in error && 'message' in error && 'error' in error;
};

export interface SymfonyErrorTrace {
  args: string[];
  class: string;
  file: string;
  function: string;
  line: number;
  namespace: string;
  short_class: string;
  type: string;
}

export interface SymfonyError {
  class: string;
  detail: string;
  status: number;
  title: string;
  trace: SymfonyErrorTrace[];
  type: string;
}

export const isSymfonyError = (error: unknown): error is SymfonyError => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const symfonyError = error as SymfonyError;

  return (
    symfonyError.class !== undefined &&
    symfonyError.detail !== undefined &&
    symfonyError.status !== undefined &&
    symfonyError.title !== undefined &&
    symfonyError.trace !== undefined &&
    symfonyError.type !== undefined
  );
};

export const isSymfonyPagerfantaOutOfRangeError = (error: unknown): error is SymfonyError => {
  if (!isSymfonyError(error)) {
    return false;
  }

  return error.class.startsWith('Pagerfanta') && error.class.endsWith('OutOfRangeCurrentPageException');
};

export const isSymfonyFormViolationListError = (error: unknown): error is FormViolationListView => {
  return typeof error === 'object' && error !== null && 'violations' in error;
};

export const isSymfonyListError = (error: unknown): error is FormViolationView[] => {
  return (
    !!error &&
    typeof error === 'object' &&
    Array.isArray(error) &&
    !!error.length &&
    typeof error[0] === 'object' &&
    'message' in error[0] &&
    'propertyPath' in error[0] &&
    'invalidValue' in error[0]
  );
};
