import { HttpErrorResponse } from '@angular/common/http';
import {
  createQueryErrorResponse,
  registerQueryErrorParser,
  shouldRetryRequest,
  symfonyQueryErrorParser,
} from '@ethlete/query';

registerQueryErrorParser(symfonyQueryErrorParser);

export const createExampleError = (status: number, body: unknown) =>
  createQueryErrorResponse(new HttpErrorResponse({ error: body, status, statusText: 'Error', url: '/api/teams/42' }), {
    retryCount: 0,
    retryFn: shouldRetryRequest,
  });
