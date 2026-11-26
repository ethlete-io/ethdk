import { HttpErrorResponse } from '@angular/common/http';
import { effect, ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { setupQueryTest } from './query-test-setup';

describe('setupQueryTest', () => {
  it('installs one console wrapper no matter how many times it is called, and leaves console.warn alone', () => {
    const pristineWarn = console.warn;
    const pristineError = console.error;

    const first = setupQueryTest();
    const wrappedError = console.error;

    expect(console.warn).toBe(pristineWarn);
    expect(wrappedError).not.toBe(pristineError);

    TestBed.resetTestingModule();
    const second = setupQueryTest();

    expect(console.error).toBe(wrappedError);

    second.restoreConsole();

    expect(console.error).toBe(pristineError);

    first.restoreConsole();

    expect(console.error).toBe(pristineError);
  });

  it('restores the console when the TestBed module is reset', () => {
    const pristineError = console.error;

    setupQueryTest();
    expect(console.error).not.toBe(pristineError);

    TestBed.resetTestingModule();

    expect(console.error).toBe(pristineError);
  });

  it('swallows a failed request reported to the ErrorHandler, and rethrows any other error', () => {
    const setup = setupQueryTest();
    const handler = TestBed.inject(ErrorHandler);

    expect(() => handler.handleError(new HttpErrorResponse({ status: 500 }))).not.toThrow();
    expect(() => handler.handleError(new Error('boom'))).toThrow('boom');

    setup.restoreConsole();
  });

  it("swallows every ErrorHandler error with mockErrorHandler: 'all'", () => {
    const setup = setupQueryTest({ mockErrorHandler: 'all' });

    expect(() => TestBed.inject(ErrorHandler).handleError(new Error('boom'))).not.toThrow();

    setup.restoreConsole();
  });

  it('rethrows an error from an effect instead of hiding it', () => {
    const setup = setupQueryTest();

    TestBed.runInInjectionContext(() =>
      effect(() => {
        throw new Error('effect failed');
      }),
    );

    expect(() => TestBed.tick()).toThrow('effect failed');

    setup.restoreConsole();
  });

  it('forwards to whatever handler a spec installed before it ran', () => {
    const spy = vi.fn();
    const pristineError = console.error;
    console.error = spy;

    try {
      const setup = setupQueryTest();

      console.error('a message no filter suppresses');
      expect(spy).toHaveBeenCalledWith('a message no filter suppresses');

      setup.restoreConsole();
      expect(console.error).toBe(spy);
    } finally {
      console.error = pristineError;
    }
  });

  it('still suppresses the messages it filters', () => {
    const pristineError = console.error;
    const spy = vi.fn();
    console.error = spy;

    try {
      const setup = setupQueryTest();

      console.error('Failed to decrypt bearer token');
      console.error({ name: 'HttpErrorResponse' });

      expect(spy).not.toHaveBeenCalled();

      setup.restoreConsole();
    } finally {
      console.error = pristineError;
    }
  });
});
