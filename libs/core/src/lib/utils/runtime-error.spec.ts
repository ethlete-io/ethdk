import { formatRuntimeError, RUNTIME_ERROR_NO_DATA, RuntimeError } from './runtime-error';

describe('formatRuntimeError', () => {
  it.each([
    [1, 'ET001'],
    [42, 'ET042'],
    [123, 'ET123'],
    [1234, 'ET1234'],
  ])('pads code %s to %s', (code, expected) => {
    expect(formatRuntimeError(code, null)).toBe(expected);
  });

  it('appends the message only when there is one', () => {
    expect(formatRuntimeError(7, 'broken')).toBe('ET007: broken');
    expect(formatRuntimeError(7, false)).toBe('ET007');
    expect(formatRuntimeError(7, '')).toBe('ET007');
  });
});

describe('RuntimeError', () => {
  beforeEach(() => vi.useFakeTimers());

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('formats its message and exposes code and data', () => {
    const error = new RuntimeError(5, 'nope');

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('ET005: nope');
    expect(error.code).toBe(5);
    expect(error.data).toBe(RUNTIME_ERROR_NO_DATA);
  });

  it('does not log anything without data', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    new RuntimeError(5, 'nope');
    vi.runAllTimers();

    expect(spy).not.toHaveBeenCalled();
  });

  it('logs the data after the error, not synchronously', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const data = { id: 1 };

    const error = new RuntimeError(5, 'nope', data);

    expect(error.data).toBe(data);
    expect(spy).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(spy).toHaveBeenCalledExactlyOnceWith(data);
  });
});
