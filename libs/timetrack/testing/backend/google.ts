import { FakeAnswer, FakeRoutedRequest, notFound, ok } from './route';

/**
 * Google's OAuth endpoints, so far as a spec needs them. A revocation answers 200 with an empty body,
 * which is what Google does. Seed a fault to make it refuse.
 */
export const respondGoogle = (request: FakeRoutedRequest): FakeAnswer =>
  request.method === 'POST' && request.path === '/revoke' ? ok({}) : notFound(request);
