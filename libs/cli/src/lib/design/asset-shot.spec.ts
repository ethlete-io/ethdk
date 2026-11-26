import { describe, expect, it, vi } from 'vitest';
import { dataUrlOf, designAssetShot, designToken, hexOf, propertyOf } from './asset-shot';

describe('hexOf', () => {
  it('pads and rounds each channel', () => {
    expect(hexOf([37, 99, 235, 255])).toBe('#2563eb');
    expect(hexOf([0, 5, 15.4, 255])).toBe('#00050f');
  });

  it('appends alpha only when not opaque', () => {
    expect(hexOf([255, 255, 255, 128])).toBe('#ffffff80');
  });
});

describe('propertyOf', () => {
  it('adds the leading dashes once', () => {
    expect(propertyOf('color-et-accent')).toBe('--color-et-accent');
    expect(propertyOf('--color-et-accent')).toBe('--color-et-accent');
  });
});

describe('dataUrlOf', () => {
  it('inlines an image by its extension', () => {
    expect(dataUrlOf({ file: '/a/mark.SVG', content: Buffer.from('<svg/>') })).toBe(
      `data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`,
    );
    expect(dataUrlOf({ file: 'a.webp', content: Buffer.from('x') })).toMatch(/^data:image\/webp;base64,/);
  });

  it('refuses a file that is not an image', () => {
    expect(dataUrlOf({ file: 'notes.txt', content: Buffer.from('x') })).toBeNull();
  });
});

describe('argument parsing', () => {
  it('rejects a shot without a value or with a bad width', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(await designAssetShot({ target: '/x', argv: ['--asset'], invocation: 'et design' })).toBe(2);
    expect(
      await designAssetShot({ target: '/x', argv: ['--asset', 'a.svg', '--width', '0'], invocation: 'et design' }),
    ).toBe(2);
    expect(error.mock.calls.at(-1)?.[0]).toContain('usage: et design shot --asset');
    error.mockRestore();
  });

  it('rejects a token without a name', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(await designToken({ target: '/x', argv: ['--hex'], invocation: 'et design' })).toBe(2);
    expect(error.mock.calls.at(-1)?.[0]).toContain('usage: et design token');
    error.mockRestore();
  });
});
