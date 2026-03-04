import { HttpErrorResponse } from '@angular/common/http';
import { createQueryErrorResponse } from './query-error-response';

describe('createQueryErrorResponse', () => {
  it('should wrap a non-HttpErrorResponse as a status 0 error', () => {
    const result = createQueryErrorResponse('unexpected error');
    expect(result.code).toBe(0);
    expect(result.isList).toBe(false);
  });

  it('should expose the raw HttpErrorResponse and status code', () => {
    const httpError = new HttpErrorResponse({ status: 404, error: 'not found' });
    const result = createQueryErrorResponse(httpError);
    expect(result.raw).toBe(httpError);
    expect(result.code).toBe(404);
  });

  it('should parse class validator errors into a list', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { statusCode: 400, message: ['field is required', 'email invalid'], error: 'Bad Request' },
    });
    const result = createQueryErrorResponse(error);
    expect(result.isList).toBe(true);
    if (result.isList) {
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]?.message).toBe('field is required');
    }
  });

  it('should parse symfony form violation list errors', () => {
    const error = new HttpErrorResponse({
      status: 422,
      error: { violations: [{ message: 'name must not be empty' }, { message: 'email is invalid' }] },
    });
    const result = createQueryErrorResponse(error);
    expect(result.isList).toBe(true);
    if (result.isList) expect(result.errors[0]?.message).toBe('name must not be empty');
  });

  it('should parse a simple object with a message field', () => {
    const error = new HttpErrorResponse({ status: 400, error: { message: 'bad request' } });
    const result = createQueryErrorResponse(error);
    expect(result.isList).toBe(false);
    if (!result.isList) expect(result.error.message).toBe('bad request');
  });

  it('should parse a symfony detail field (dev mode)', () => {
    const error = new HttpErrorResponse({ status: 500, error: { detail: 'internal error detail' } });
    const result = createQueryErrorResponse(error);
    expect(result.isList).toBe(false);
    if (!result.isList) expect(result.error.message).toBe('internal error detail');
  });

  it('should parse a plain string error', () => {
    const error = new HttpErrorResponse({ status: 400, error: 'just a string' });
    const result = createQueryErrorResponse(error);
    expect(result.isList).toBe(false);
    if (!result.isList) expect(result.error.message).toBe('just a string');
  });

  it('should return a single error when only one message is present', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { statusCode: 400, message: ['only one'], error: 'Bad Request' },
    });
    const result = createQueryErrorResponse(error);
    expect(result.isList).toBe(false);
  });
});
