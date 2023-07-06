import { FormViolationListView } from '@ethlete/types';
import { SymfonyError } from './symfony.types';

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
