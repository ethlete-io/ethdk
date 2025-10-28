import { HttpClient, HttpEventType, HttpSentEvent, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createHttpRequest, HttpRequest, SPEED_BUFFER_TIME_IN_MS } from './http-request';
import { QueryArgs } from './query';

describe('createHttpRequest', () => {
  let testingController: HttpTestingController;
  let req: HttpRequest<QueryArgs>;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    jest.useFakeTimers();
    errorSpy = jest.spyOn(TestBed.inject(ErrorHandler), 'handleError').mockImplementation();

    testingController = TestBed.inject(HttpTestingController);

    req = createHttpRequest({
      fullPath: 'https://example.com/test',
      method: 'GET',
      dependencies: {
        httpClient: TestBed.inject(HttpClient),
        ngErrorHandler: TestBed.inject(ErrorHandler),
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    errorSpy.mockRestore();
  });

  const expectAllNull = () => {
    expect(req.currentEvent()).toBeNull();
    expect(req.error()).toBeNull();
    expect(req.loading()).toBeNull();
    expect(req.response()).toBeNull();
  };

  const expectSendAndLoading = (existingResponse?: unknown) => {
    expect(req.currentEvent()).toEqual(sendEvent);
    expect(req.error()).toBeNull();
    expect(req.loading()?.progress).toEqual(null);

    if (existingResponse) {
      expect(req.response()).toEqual(existingResponse);
    } else {
      expect(req.response()).toBeNull();
    }
  };

  const expectResponse = () => {
    expect(req.currentEvent()?.type).toEqual(HttpEventType.Response);
    expect(req.error()).toBeNull();
    expect(req.loading()).toBeNull();
    expect(req.response()).toEqual(responseBody);
  };

  const expectResponse2 = () => {
    expect(req.currentEvent()?.type).toEqual(HttpEventType.Response);
    expect(req.error()).toBeNull();
    expect(req.loading()).toBeNull();
    expect(req.response()).toEqual(responseBody2);
  };

  const expect404 = (cachedResponse?: unknown) => {
    expect(req.currentEvent()?.type).toEqual('error');
    expect(req.error()?.raw.status).toBe(error404.status);
    expect(req.loading()).toBeNull();

    if (cachedResponse) {
      expect(req.response()).toEqual(cachedResponse);
    } else {
      expect(req.response()).toBeNull();
    }
  };

  const expect500 = (cachedResponse?: unknown) => {
    expect(req.currentEvent()?.type).toEqual('error');
    expect(req.error()?.raw.status).toBe(error501.status);
    expect(req.loading()).toBeNull();

    if (cachedResponse) {
      expect(req.response()).toEqual(cachedResponse);
    } else {
      expect(req.response()).toBeNull();
    }
  };

  const request = () => testingController.expectOne('https://example.com/test');

  const requestAndError404 = () => {
    const fakeReq = request();

    fakeReq.error(new ProgressEvent('error 404'), error404);

    return fakeReq;
  };

  const requestAndError501 = () => {
    const fakeReq = request();

    fakeReq.error(new ProgressEvent('error 501'), error501);

    return fakeReq;
  };

  const sendEvent: HttpSentEvent = {
    type: HttpEventType.Sent,
  };

  const responseBody = { test: 'data' };
  const responseBody2 = { other: 'data 2' };

  const error404 = { status: 404, statusText: 'Not Found' };
  const error501 = { status: 501, statusText: 'Internal server error' };

  it('should create', () => {
    expect(req).toBeTruthy();
  });

  it('should create with options', () => {
    const req2 = createHttpRequest({
      fullPath: 'https://example.com/test',
      method: 'GET',
      dependencies: {
        httpClient: TestBed.inject(HttpClient),
        ngErrorHandler: TestBed.inject(ErrorHandler),
      },
      clientOptions: {
        reportProgress: true,
      },
    });

    expect(req2).toBeTruthy();
  });

  it('should correctly update its state when progress events are involved', () => {
    expectAllNull();

    req.execute();

    expectSendAndLoading();

    const testReq = request();

    for (let i = 0; i <= 100; i += 10) {
      testReq.event({ type: HttpEventType.DownloadProgress, loaded: i, total: 100 });

      if (i <= SPEED_BUFFER_TIME_IN_MS / 100) {
        // speed and remaining time are not available until SPEED_BUFFER_TIME_IN_MS has passed
        expect(req.loading()?.progress).toEqual({
          total: 100,
          loaded: i,
          percentage: i,
          speed: null,
          remainingTime: null,
        });
      } else {
        expect(req.loading()?.progress).toEqual({
          total: 100,
          loaded: i,
          percentage: i,
          speed: 10 * 1000,
          remainingTime: (10 - i / 10) * 1000,
        });
      }

      jest.advanceTimersByTime(1000);
    }

    testReq.flush(responseBody);

    expectResponse();

    testingController.verify();
  });

  it('should correctly update its state when progress events are involved but we do not have infos about the total file size', () => {
    expectAllNull();

    req.execute();

    expectSendAndLoading();

    const testReq = request();

    for (let i = 0; i <= 100; i += 10) {
      testReq.event({ type: HttpEventType.DownloadProgress, loaded: i });

      expect(req.loading()?.progress).toEqual(null);

      jest.advanceTimersByTime(1000);
    }

    testReq.flush(responseBody);

    expectResponse();

    testingController.verify();
  });

  it('should handle upload events in the same way as download events', () => {
    expectAllNull();

    req.execute();

    expectSendAndLoading();

    const testReq = request();

    for (let i = 0; i <= 100; i += 10) {
      testReq.event({ type: HttpEventType.UploadProgress, loaded: i });

      expect(req.loading()?.progress).toEqual(null);

      jest.advanceTimersByTime(1000);
    }

    testReq.flush(responseBody);

    expectResponse();

    testingController.verify();
  });

  it('should correctly update its state when the request errors', () => {
    expectAllNull();

    req.execute();

    expectSendAndLoading();

    requestAndError404();

    expect404();

    testingController.verify();
  });

  it('should correctly update its state when the request errors with a status code that can be retried', () => {
    expectAllNull();

    req.execute();
    expectSendAndLoading();

    requestAndError501();

    jest.advanceTimersByTime(2000);

    expectSendAndLoading();
    requestAndError501();

    jest.advanceTimersByTime(3000);

    expectSendAndLoading();
    requestAndError501();

    jest.advanceTimersByTime(4000);

    expectSendAndLoading();

    try {
      requestAndError501();

      jest.advanceTimersByTime(5000);
    } catch {
      // noop
    }

    expect500();

    testingController.verify();
  });

  it('should correctly update its state when the request errors with a status code that can be retried turning into a success afterwards', () => {
    expectAllNull();

    req.execute();
    expectSendAndLoading();

    requestAndError501();

    jest.advanceTimersByTime(2000);

    expectSendAndLoading();
    requestAndError501();

    jest.advanceTimersByTime(3000);

    expectSendAndLoading();
    const newReq = request();

    newReq.flush(responseBody);

    expectResponse();

    testingController.verify();
  });

  it('should correctly update its state when requested multiple times', () => {
    expectAllNull();

    req.execute();
    expectSendAndLoading();

    const newReq = request();

    newReq.flush(responseBody);

    expectResponse();

    req.execute();
    expectSendAndLoading(responseBody);

    const newReq2 = request();

    newReq2.flush(responseBody2);

    expectResponse2();

    testingController.verify();
  });

  it('should correctly update its state when requested multiple times and the last request results in an error', () => {
    expectAllNull();

    req.execute();
    expectSendAndLoading();

    const newReq = request();

    newReq.flush(responseBody);

    expectResponse();

    req.execute();
    expectSendAndLoading(responseBody);

    requestAndError404();

    expect404(responseBody);

    testingController.verify();
  });

  it('should not execute again if its already doing so', () => {
    expectAllNull();

    expect(req.execute()).toBeTruthy();

    expectSendAndLoading();

    expect(req.execute()).toBeFalsy();

    request();
  });

  it('should destroy the currently executing request', () => {
    expectAllNull();

    expect(req.destroy()).toBeFalsy();

    req.execute();

    const mockReq = request();

    expectSendAndLoading();

    expect(mockReq.cancelled).toBeFalsy();

    expect(req.destroy()).toBeTruthy();
    expect(req.destroy()).toBeFalsy();

    expect(mockReq.cancelled).toBeTruthy();
  });

  it('should result in an unknown error if something fails spectacularly inside the request', () => {
    const failingReq = createHttpRequest({
      fullPath: 'https://example.com/test',
      method: 'GET',
      dependencies: {
        httpClient: TestBed.inject(HttpClient),
        ngErrorHandler: TestBed.inject(ErrorHandler),
      },
      // NOTE: This is a hack to make the retry function fail
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      retryFn: new ArrayBuffer(8) as any,
    });

    failingReq.execute();

    requestAndError404();

    expect(failingReq.error()?.raw.status).toBe(0);
  });

  it('should use the custom cache adapter if provided', () => {
    const cacheAdapter = jest.fn(() => null);

    const testHttpReq = createHttpRequest({
      fullPath: 'https://example.com/test',
      method: 'GET',
      dependencies: {
        httpClient: TestBed.inject(HttpClient),
        ngErrorHandler: TestBed.inject(ErrorHandler),
      },
      cacheAdapter,
    });

    testHttpReq.execute();

    const testReq = request();

    testReq.flush(responseBody);

    expect(cacheAdapter).toHaveBeenCalledTimes(1);
  });

  it('should use the expires in header if present', () => {
    const testHttpReq = createHttpRequest({
      fullPath: 'https://example.com/test',
      method: 'GET',
      dependencies: {
        httpClient: TestBed.inject(HttpClient),
        ngErrorHandler: TestBed.inject(ErrorHandler),
      },
    });

    expect(testHttpReq.isStale()).toBeTruthy();

    testHttpReq.execute();

    const testReq = request();

    testReq.flush(responseBody, { headers: { expires: '10000' } });

    expect(testHttpReq.isStale()).toBeFalsy();
  });
});
