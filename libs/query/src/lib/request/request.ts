import { Observable, Observer } from 'rxjs';
import { CacheAdapterFn, Method, PartialXhrState, RequestHeaders } from './request.types';
import {
  buildTimestampFromSeconds,
  detectContentTypeHeader,
  extractExpiresInSeconds,
  forEachHeader,
  getResponseUrl,
  hasHeader,
  HttpStatusCode,
  parseAllXhrResponseHeaders,
  serializeBody,
} from './request.util';

interface RequestConfig {
  method: Method;
  url: string;
  urlWithParams: string;
  body?: unknown;
  reportProgress?: boolean;
  withCredentials?: boolean;
  responseType?: 'arraybuffer' | 'blob' | 'json' | 'text';
  headers?: RequestHeaders;
  cacheAdapter?: CacheAdapterFn;
}

type RequestEvent<Response = unknown> =
  | {
      type: 'start';
      headers: RequestHeaders;
    }
  | {
      type: 'download-progress';
      loaded: number;
      headers: RequestHeaders;
      progress?: number;
      total?: number;
      partialText?: string;
    }
  | {
      type: 'upload-progress';
      loaded: number;
      headers: RequestHeaders;
      progress?: number;
      total?: number;
    }
  | {
      type: 'success';
      headers: RequestHeaders;
      response: Response;
      expiresInTimestamp?: number;
    }
  | {
      type: 'failure';
      headers: RequestHeaders;
      error: {
        url: string;
        status: HttpStatusCode;
        statusText: string;
        event: unknown;
      };
    }
  | {
      type: 'cancel';
      headers: RequestHeaders;
    };

const XSSI_PREFIX = /^\)\]\}',?\n/;

export const request = <Response = unknown>(config: RequestConfig): Observable<RequestEvent<Response>> => {
  const headers = config.headers || {};
  const responseType = config.responseType || 'json';
  const body = config.body || null;

  return new Observable((observer: Observer<RequestEvent<Response>>) => {
    const xhr = new XMLHttpRequest();
    xhr.open(config.method, config.urlWithParams);
    if (config.withCredentials) {
      xhr.withCredentials = true;
    }

    forEachHeader(headers, (name, value) => xhr.setRequestHeader(name, value));

    if (!hasHeader(headers, 'Accept')) {
      xhr.setRequestHeader('Accept', 'application/json, text/plain, */*');
    }

    if (!hasHeader(headers, 'Content-Type')) {
      const detectedType = detectContentTypeHeader(body);

      if (detectedType) {
        xhr.setRequestHeader('Content-Type', detectedType);
      }
    }

    xhr.responseType = responseType !== 'json' ? responseType : 'text';

    const reqBody = serializeBody(body);

    let headerResponse: PartialXhrState | null = null;

    const partialFromXhr = (): PartialXhrState => {
      if (headerResponse !== null) {
        return headerResponse;
      }

      const statusText = xhr.statusText || 'OK';
      const headers = parseAllXhrResponseHeaders(xhr);
      const url = getResponseUrl(xhr) || config.url;

      headerResponse = { headers, status: xhr.status, statusText, url };

      return headerResponse;
    };

    const onLoad = () => {
      const { headers, statusText, url } = partialFromXhr();
      let { status } = partialFromXhr();

      let body: unknown | null = null;

      if (status !== HttpStatusCode.NoContent) {
        body = typeof xhr.response === 'undefined' ? xhr.responseText : xhr.response;
      }

      if (status === 0) {
        status = body ? HttpStatusCode.Ok : 0;
      }

      let ok = status >= 200 && status < 300;

      if (responseType === 'json' && typeof body === 'string') {
        const originalBody = body;
        body = body.replace(XSSI_PREFIX, '');
        try {
          body = body !== '' ? JSON.parse(body as string) : null;
        } catch (error) {
          body = originalBody;

          if (ok) {
            ok = false;
            body = { error, text: body };
          }
        }
      }

      if (ok) {
        const successEvent: RequestEvent<Response> = {
          type: 'success',
          headers,
          response: body as Response,
        };

        const expiresInSeconds = config.cacheAdapter?.(headers) ?? extractExpiresInSeconds(headers);
        const expiresInTimestamp = buildTimestampFromSeconds(expiresInSeconds);

        if (expiresInTimestamp) {
          successEvent.expiresInTimestamp = expiresInTimestamp;
        }

        observer.next(successEvent);

        observer.complete();
      } else {
        observer.next({
          type: 'failure',
          headers,
          error: {
            url,
            event: body,
            status,
            statusText,
          },
        });

        observer.complete();
      }
    };

    const onError = (error: ProgressEvent) => {
      const { url, headers } = partialFromXhr();

      observer.next({
        type: 'failure',
        headers,
        error: {
          url,
          event: error,
          status: xhr.status || 0,
          statusText: xhr.statusText || 'Unknown Error',
        },
      });

      observer.complete();
    };

    const onDownProgress = (event: ProgressEvent) => {
      const { headers } = partialFromXhr();

      const progress: RequestEvent = {
        type: 'download-progress',
        headers,
        loaded: event.loaded,
      };

      if (event.lengthComputable) {
        progress.total = event.total;
        progress.progress = event.loaded / event.total;
      }

      if (responseType === 'text' && !!xhr.responseText) {
        progress.partialText = xhr.responseText;
      }

      observer.next(progress);
    };

    const onUpProgress = (event: ProgressEvent) => {
      const { headers } = partialFromXhr();

      const progress: RequestEvent = {
        type: 'upload-progress',
        headers,
        loaded: event.loaded,
      };

      if (event.lengthComputable) {
        progress.total = event.total;
        progress.progress = event.loaded / event.total;
      }

      observer.next(progress);
    };

    xhr.addEventListener('load', onLoad);
    xhr.addEventListener('error', onError);
    xhr.addEventListener('timeout', onError);
    xhr.addEventListener('abort', onError);

    if (config.reportProgress) {
      xhr.addEventListener('progress', onDownProgress);

      if (reqBody !== null && xhr.upload) {
        xhr.upload.addEventListener('progress', onUpProgress);
      }
    }

    xhr.send(reqBody);
    observer.next({ type: 'start', headers });

    return () => {
      xhr.removeEventListener('error', onError);
      xhr.removeEventListener('abort', onError);
      xhr.removeEventListener('load', onLoad);
      xhr.removeEventListener('timeout', onError);
      if (config.reportProgress) {
        xhr.removeEventListener('progress', onDownProgress);
        if (reqBody !== null && xhr.upload) {
          xhr.upload.removeEventListener('progress', onUpProgress);
        }
      }

      if (xhr.readyState !== xhr.DONE) {
        xhr.abort();
      }

      observer.next({ type: 'cancel', headers });
    };
  });
};
