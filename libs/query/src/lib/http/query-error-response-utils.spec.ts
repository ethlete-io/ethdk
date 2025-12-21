import {
  isClassValidatorError,
  isSymfonyError,
  isSymfonyFormViolationListError,
  isSymfonyListError,
  isSymfonyPagerfantaOutOfRangeError,
} from './query-error-response-utils';

describe('query error response utils', () => {
  describe('isClassValidatorError', () => {
    it('should return true for valid class validator error', () => {
      const error = {
        statusCode: 400,
        message: ['field is required'],
        error: 'Bad Request',
      };
      expect(isClassValidatorError(error)).toBe(true);
    });

    it('should return false for invalid error', () => {
      expect(isClassValidatorError(null)).toBe(false);
      expect(isClassValidatorError(undefined)).toBe(false);
      expect(isClassValidatorError({})).toBe(false);
      expect(isClassValidatorError({ statusCode: 400 })).toBe(false);
    });
  });

  describe('isSymfonyError', () => {
    it('should return true for valid symfony error', () => {
      const error = {
        class: 'Exception',
        detail: 'Error details',
        status: 500,
        title: 'Internal Server Error',
        trace: [],
        type: 'error',
      };
      expect(isSymfonyError(error)).toBe(true);
    });

    it('should return false for invalid error', () => {
      expect(isSymfonyError(null)).toBe(false);
      expect(isSymfonyError({})).toBe(false);
      expect(isSymfonyError({ class: 'Test' })).toBe(false);
    });
  });

  describe('isSymfonyPagerfantaOutOfRangeError', () => {
    it('should return true for pagerfanta out of range error', () => {
      const error = {
        class: 'Pagerfanta\\Exception\\OutOfRangeCurrentPageException',
        detail: 'Page out of range',
        status: 404,
        title: 'Not Found',
        trace: [],
        type: 'error',
      };
      expect(isSymfonyPagerfantaOutOfRangeError(error)).toBe(true);
    });

    it('should return false for non-pagerfanta error', () => {
      const error = {
        class: 'Exception',
        detail: 'Error',
        status: 500,
        title: 'Error',
        trace: [],
        type: 'error',
      };
      expect(isSymfonyPagerfantaOutOfRangeError(error)).toBe(false);
    });
  });

  describe('isSymfonyFormViolationListError', () => {
    it('should return true for form violation list error', () => {
      const error = { violations: [] };
      expect(isSymfonyFormViolationListError(error)).toBe(true);
    });

    it('should return false for invalid error', () => {
      expect(isSymfonyFormViolationListError(null)).toBe(false);
      expect(isSymfonyFormViolationListError({})).toBe(false);
    });
  });

  describe('isSymfonyListError', () => {
    it('should return true for symfony list error', () => {
      const error = [{ message: 'Error', propertyPath: 'field', invalidValue: null }];
      expect(isSymfonyListError(error)).toBe(true);
    });

    it('should return false for invalid error', () => {
      expect(isSymfonyListError(null)).toBe(false);
      expect(isSymfonyListError([])).toBe(false);
      expect(isSymfonyListError([{}])).toBe(false);
    });
  });
});
