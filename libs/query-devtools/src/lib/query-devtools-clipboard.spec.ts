import { writeQueryDevtoolsClipboard } from './query-devtools-clipboard';

const withoutClipboard = () => Reflect.deleteProperty(navigator, 'clipboard');

const withExecCommand = (result: boolean | (() => boolean)) => {
  const execCommand = vi.fn(typeof result === 'function' ? result : () => result);
  Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });

  return execCommand;
};

describe('writeQueryDevtoolsClipboard', () => {
  afterEach(() => {
    withoutClipboard();
    Reflect.deleteProperty(document, 'execCommand');
  });

  it('should copy through the clipboard API when there is one', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    await expect(writeQueryDevtoolsClipboard({ text: 'hi' })).resolves.toEqual({ ok: true });
    expect(writeText).toHaveBeenCalledWith('hi');
  });

  it('should fall back to a copy command where navigator.clipboard is missing', async () => {
    withoutClipboard();
    const execCommand = withExecCommand(true);

    await expect(writeQueryDevtoolsClipboard({ text: 'hi' })).resolves.toEqual({ ok: true });
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBe(null);
  });

  it('should report an unavailable clipboard instead of doing nothing', async () => {
    withoutClipboard();
    withExecCommand(false);

    await expect(writeQueryDevtoolsClipboard({ text: 'hi' })).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });

  it('should fall back to a copy command when the clipboard API rejects', async () => {
    const writeText = vi.fn(() => Promise.reject(new Error('denied')));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const execCommand = withExecCommand(true);

    await expect(writeQueryDevtoolsClipboard({ text: 'hi' })).resolves.toEqual({ ok: true });
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('should report a blocked write when neither path lands', async () => {
    const writeText = vi.fn(() => Promise.reject(new Error('denied')));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    withExecCommand(false);

    await expect(writeQueryDevtoolsClipboard({ text: 'hi' })).resolves.toEqual({ ok: false, reason: 'blocked' });
  });
});
