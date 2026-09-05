import { TestBed } from '@angular/core/testing';
import { setupQueryTest } from './query-test-setup';

describe('setupQueryTest', () => {
  it('installs one console wrapper no matter how many times it is called', () => {
    const pristineWarn = console.warn;
    const pristineError = console.error;

    const first = setupQueryTest();
    const wrappedWarn = console.warn;
    const wrappedError = console.error;

    expect(wrappedWarn).not.toBe(pristineWarn);
    expect(wrappedError).not.toBe(pristineError);

    TestBed.resetTestingModule();
    const second = setupQueryTest();

    expect(console.warn).toBe(wrappedWarn);
    expect(console.error).toBe(wrappedError);

    second.restoreConsole();

    expect(console.warn).toBe(pristineWarn);
    expect(console.error).toBe(pristineError);

    first.restoreConsole();

    expect(console.warn).toBe(pristineWarn);
    expect(console.error).toBe(pristineError);
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
