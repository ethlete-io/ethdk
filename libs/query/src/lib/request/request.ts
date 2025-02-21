import { HttpStatusCode } from '@angular/common/http';
import { Observable, Observer } from 'rxjs';
import { PartialXhrState, RequestConfig, RequestError, RequestEvent } from './request.types';
import {
  buildTimestampFromSeconds,
  detectContentTypeHeader,
  extractExpiresInSeconds,
  forEachHeader,
  getResponseUrl,
  hasHeader,
  parseAllXhrResponseHeaders,
  serializeBody,
  shouldRetryRequest,
} from './request.util';

const XSSI_PREFIX = /^\)\]\}',?\n/;

export const request = <Response = unknown>(config: RequestConfig): Observable<RequestEvent<Response>> => {
  const headers = config.headers || {};
  const responseType = config.responseType || 'json';
  const body = config.body || null;
  const url = config.urlWithParams.split('?')[0] || '';
  const retryFn = config.retryFn || shouldRetryRequest;
  let currentRetryCount = 0;
  let retryTimeout: number | null = null;

  return new Observable((observer: Observer<RequestEvent<Response>>) => {
    const xhr = new XMLHttpRequest();
    const reqBody = serializeBody(body);

    const setupXhr = () => {
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
    };

    setupXhr();

    const partialFromXhr = (): PartialXhrState => {
      const statusText = xhr.statusText || 'OK';
      const headers = parseAllXhrResponseHeaders(xhr);
      const _url = getResponseUrl(xhr) || url;

      return { headers, status: xhr.status, statusText, url: _url };
    };

    const handleRetry = (error: RequestError) => {
      const newRetryCount = currentRetryCount + 1;
      const { headers } = partialFromXhr();
      const { retry, delay } = retryFn({ currentRetryCount: newRetryCount, headers, error });

      if (!retry) {
        observer.next({ type: 'failure', headers, error });
        observer.complete();
        return;
      }

      const _delay = delay ?? 1000;
      observer.next({ type: 'delay-retry', headers, retryNumber: newRetryCount, retryDelay: _delay });

      retryTimeout = window.setTimeout(() => {
        setupXhr();
        xhr.send(reqBody);
        currentRetryCount = newRetryCount;
        observer.next({ type: 'start', headers, isRetry: true, retryNumber: currentRetryCount, retryDelay: _delay });
      }, _delay);
    };

    const onLoad = async () => {
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
      } else if (!ok && body instanceof Blob) {
        try {
          const text = await body.text();

          if (body.type === 'application/json') {
            body = JSON.parse(text);
          } else {
            body = text;
          }
        } catch (error) {
          // Ignore the error.
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
        handleRetry({
          url,
          detail: body,
          status,
          statusText,
        });
      }
    };

    const onError = (error: Event) => {
      const { url } = partialFromXhr();

      handleRetry({
        url,
        detail: error,
        status: xhr.status || 0,
        statusText: xhr.statusText || 'Unknown Error',
      });
    };

    const onDownProgress = (event: ProgressEvent) => {
      const { headers } = partialFromXhr();

      const progress: RequestEvent = {
        type: 'download-progress',
        headers,
        progress: {
          current: event.loaded,
        },
      };

      if (event.lengthComputable) {
        const progressPercent = (event.loaded / event.total) * 100;
        progress.progress.percentage = Math.round(progressPercent * 100) / 100;
        progress.progress.total = event.total;
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
        progress: {
          current: event.loaded,
        },
      };

      if (event.lengthComputable) {
        const progressPercent = (event.loaded / event.total) * 100;
        progress.progress.percentage = Math.round(progressPercent * 100) / 100;
        progress.progress.total = event.total;
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

      if (retryTimeout) {
        window.clearTimeout(retryTimeout);
      }

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
