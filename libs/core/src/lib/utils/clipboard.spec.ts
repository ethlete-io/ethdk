import { copyToClipboard, readFromClipboard } from './clipboard';

const stubClipboard = (clipboard: Partial<Clipboard> | undefined) => {
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
};

describe('copyToClipboard', () => {
  afterEach(() => {
    stubClipboard(undefined);
  });

  it('should copy via the async Clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });

    await expect(copyToClipboard('hello')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('should fall back to execCommand when the Clipboard API rejects', async () => {
    stubClipboard({ writeText: vi.fn().mockRejectedValue(new Error('blocked')) });
    document.execCommand = vi.fn().mockReturnValue(true);

    await expect(copyToClipboard('hello')).resolves.toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });

  it('should use execCommand directly when the Clipboard API is unavailable', async () => {
    document.execCommand = vi.fn().mockReturnValue(true);

    await expect(copyToClipboard('hello')).resolves.toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });

  it('should report failure when both strategies fail', async () => {
    stubClipboard({ writeText: vi.fn().mockRejectedValue(new Error('blocked')) });
    document.execCommand = vi.fn().mockReturnValue(false);

    await expect(copyToClipboard('hello')).resolves.toBe(false);
  });

  it('should not leave the fallback textarea in the document', async () => {
    document.execCommand = vi.fn().mockReturnValue(true);

    await copyToClipboard('hello');

    expect(document.querySelector('textarea')).toBeNull();
  });

  it('should restore focus to the previously focused element', async () => {
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();
    document.execCommand = vi.fn().mockReturnValue(true);

    await copyToClipboard('hello');

    expect(document.activeElement).toBe(button);
    button.remove();
  });
});

describe('readFromClipboard', () => {
  afterEach(() => {
    stubClipboard(undefined);
  });

  it('should read via the async Clipboard API', async () => {
    stubClipboard({ readText: vi.fn().mockResolvedValue('hello') });

    await expect(readFromClipboard()).resolves.toBe('hello');
  });

  it('should return null when the Clipboard API is unavailable', async () => {
    await expect(readFromClipboard()).resolves.toBeNull();
  });

  it('should return null when reading is blocked', async () => {
    stubClipboard({ readText: vi.fn().mockRejectedValue(new Error('blocked')) });

    await expect(readFromClipboard()).resolves.toBeNull();
  });
});
