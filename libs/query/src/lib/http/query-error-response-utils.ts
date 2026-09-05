import { FormViolationListView, FormViolationView } from '@ethlete/types';

export type ClassValidatorError = {
  statusCode: number;
  message: string[];
  error: string;
};

export const isClassValidatorError = (error: unknown): error is ClassValidatorError => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    'error' in error &&
    'message' in error &&
    Array.isArray(error.message)
  );
};

export type SymfonyErrorTrace = {
  args: string[];
  class: string;
  file: string;
  function: string;
  line: number;
  namespace: string;
  short_class: string;
  type: string;
};

export type SymfonyError = {
  class: string;
  detail: string;
  status: number;
  title: string;
  trace: SymfonyErrorTrace[];
  type: string;
};

export const isSymfonyError = (error: unknown): error is SymfonyError => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const symfonyError = error as Partial<SymfonyError>;

  return (
    typeof symfonyError.class === 'string' &&
    symfonyError.detail !== undefined &&
    symfonyError.status !== undefined &&
    symfonyError.title !== undefined &&
    Array.isArray(symfonyError.trace) &&
    symfonyError.type !== undefined
  );
};

export const isSymfonyPagerfantaOutOfRangeError = (error: unknown): error is SymfonyError => {
  if (!isSymfonyError(error)) {
    return false;
  }

  return error.class.startsWith('Pagerfanta') && error.class.endsWith('OutOfRangeCurrentPageException');
};

const isFormViolationView = (value: unknown): value is FormViolationView => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof value.message === 'string' &&
    (!('propertyPath' in value) || value.propertyPath === null || typeof value.propertyPath === 'string')
  );
};

export const isSymfonyFormViolationListError = (error: unknown): error is FormViolationListView => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'violations' in error &&
    Array.isArray(error.violations) &&
    error.violations.every(isFormViolationView)
  );
};

export const isSymfonyListError = (error: unknown): error is FormViolationView[] => {
  return (
    Array.isArray(error) &&
    !!error.length &&
    error.every((item) => isFormViolationView(item) && 'propertyPath' in item && 'invalidValue' in item)
  );
};
