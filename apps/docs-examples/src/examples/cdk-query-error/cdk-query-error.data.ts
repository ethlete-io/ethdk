import { HttpErrorResponse } from '@angular/common/http';
import { RequestError } from '@ethlete/query';

export const createExampleError = (status: number, detail: unknown): RequestError => ({
  detail,
  status,
  statusText: 'Error',
  url: 'https://example.com',
  httpErrorResponse: new HttpErrorResponse({ error: detail, status }),
});
