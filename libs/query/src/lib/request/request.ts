import { CacheAdapterFn } from './request.types';
import { buildRequestError, buildTimestampFromSeconds, extractExpiresInSeconds } from './request.util';

export const request = async <Response = unknown>(options: {
  route: string;
  init?: RequestInit;
  cacheAdapter?: CacheAdapterFn;
}) => {
  try {
    const response = await fetch(options.route, options.init);

    if (!response.ok) {
      throw response;
    }

    const isJsonResponse = response.headers.get('Content-Type')?.includes('application/json');
    const isTextResponse = response.headers.get('Content-Type')?.includes('text/plain');

    const data = (isJsonResponse ? await response.json() : isTextResponse ? await response.text() : null) as Response;

    const expiresInSeconds = options.cacheAdapter
      ? options.cacheAdapter(response.headers)
      : extractExpiresInSeconds(response.headers);

    const expiresInTimestamp = buildTimestampFromSeconds(expiresInSeconds);

    return { data, expiresInTimestamp };
  } catch (error) {
    throw await buildRequestError(error, options.route, options.init);
  }
};
