import { describe, expect, it, vi } from 'vitest';
import { contactSheetHtml, contactSheetOf, diffPixelsOf } from './contact-sheet';
import { Browser } from './thumb';

describe('contactSheetHtml', () => {
  it('lays one row of figures per row, each with its escaped label', () => {
    const html = contactSheetHtml([
      [
        { label: 'rest', png: Buffer.from('a') },
        { label: '<hover>', error: 'boom & more' },
      ],
      [{ label: 'a / rest', png: Buffer.from('b') }],
    ]);

    expect(html.match(/class="row"/gu)).toHaveLength(2);
    expect(html).toContain('<figcaption>rest</figcaption>');
    expect(html).toContain('<figcaption>&lt;hover&gt;</figcaption>');
    expect(html).toContain('data:image/png;base64,YQ==');
    expect(html).toContain('<pre>boom &amp; more</pre>');
  });

  it('marks a diff of equal PNGs as no pixel change, and draws one of different PNGs into a canvas', () => {
    const html = contactSheetHtml([
      [
        { label: 'a vs merged', before: Buffer.from('a'), after: Buffer.from('a'), over: 'a' },
        { label: 'b vs merged', before: Buffer.from('a'), after: Buffer.from('b'), over: 'b' },
      ],
    ]);

    expect(html).toContain('<pre class="same">no pixel change</pre>');
    expect(html).toContain('<figure data-diff data-over="b"><figcaption>b vs merged</figcaption>');
    expect(html).toContain(
      '<canvas data-before="data:image/png;base64,YQ==" data-after="data:image/png;base64,Yg=="></canvas>',
    );
  });
});

describe('diffPixelsOf', () => {
  const pixels = (width: number, height: number, values: number[]) => ({
    width,
    height,
    data: new Uint8ClampedArray(values),
  });

  it('paints a changed pixel red and fades an equal one, and counts the changed ones', () => {
    const before = pixels(2, 1, [0, 0, 0, 255, 255, 255, 255, 255]);
    const after = pixels(2, 1, [0, 0, 0, 255, 0, 0, 255, 255]);

    expect(diffPixelsOf(before, after)).toEqual({
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([191, 191, 191, 255, 255, 0, 0, 255]),
      changed: 1,
    });
  });

  it('counts a pixel only one side covers as changed', () => {
    const diff = diffPixelsOf(pixels(1, 1, [9, 9, 9, 255]), pixels(1, 2, [9, 9, 9, 255, 9, 9, 9, 255]));

    expect([diff.width, diff.height, diff.changed]).toEqual([1, 2, 1]);
  });

  it('runs from its own source, as the sheet page runs it', () => {
    const fromSource = new Function(`return ${diffPixelsOf.toString()}`)() as typeof diffPixelsOf;

    expect(fromSource(pixels(1, 1, [1, 2, 3, 4]), pixels(1, 1, [1, 2, 3, 4])).changed).toBe(0);
  });
});

describe('contactSheetOf', () => {
  it('sizes the viewport to the sheet, screenshots it in full and closes the context', async () => {
    const page = {
      setContent: vi.fn(),
      evaluate: vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(900),
      setViewportSize: vi.fn(),
      screenshot: vi.fn().mockResolvedValue(Buffer.from('png')),
    };
    const context = { newPage: vi.fn().mockResolvedValue(page), close: vi.fn() };
    const browser = { newContext: vi.fn().mockResolvedValue(context) } as unknown as Browser;

    const { png, diffs } = await contactSheetOf({ browser, rows: [[{ label: 'x', png: Buffer.from('a') }]] });

    expect(png.toString()).toBe('png');
    expect(diffs).toEqual([]);
    expect(page.setViewportSize).toHaveBeenCalledWith({ width: 900, height: 1 });
    expect(page.screenshot).toHaveBeenCalledWith({ fullPage: true, type: 'png' });
    expect(context.close).toHaveBeenCalled();
  });

  it('draws the diff cells in the page before it measures the sheet', async () => {
    const page = {
      setContent: vi.fn(),
      evaluate: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(['x vs merged: 12 px changed'])
        .mockResolvedValueOnce(700),
      setViewportSize: vi.fn(),
      screenshot: vi.fn().mockResolvedValue(Buffer.from('png')),
    };
    const context = { newPage: vi.fn().mockResolvedValue(page), close: vi.fn() };
    const browser = { newContext: vi.fn().mockResolvedValue(context) } as unknown as Browser;

    const { diffs } = await contactSheetOf({
      browser,
      rows: [[{ label: 'x', before: Buffer.from('a'), after: Buffer.from('b') }]],
    });

    expect(diffs).toEqual(['x vs merged: 12 px changed']);
    expect(page.evaluate.mock.calls[1]?.[0]).toContain('function diffPixelsOf');
    expect(page.evaluate.mock.calls[1]?.[0]).toContain('canvas.style.width = above.getBoundingClientRect().width');
    expect(page.setViewportSize).toHaveBeenCalledWith({ width: 700, height: 1 });
  });
});
