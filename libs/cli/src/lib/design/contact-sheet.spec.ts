import { describe, expect, it, vi } from 'vitest';
import {
  changedBoxesOf,
  changedCropsOf,
  clusteredBoxesOf,
  contactSheetHtml,
  contactSheetOf,
  diffPixelsOf,
  pngSizeOf,
} from './contact-sheet';
import { Browser } from './thumb';

describe('contactSheetHtml', () => {
  it('lays one row of figures per row, each with its escaped label', () => {
    const html = contactSheetHtml([
      [
        { label: 'rest', png: Buffer.from('a') },
        { label: '<hover>', error: 'boom & more' },
        { label: 'merged', note: 'new & empty' },
      ],
      [{ label: 'a / rest', png: Buffer.from('b') }],
    ]);

    expect(html.match(/class="row"/gu)).toHaveLength(2);
    expect(html).toContain('<figcaption>rest</figcaption>');
    expect(html).toContain('<figcaption>&lt;hover&gt;</figcaption>');
    expect(html).toContain('data:image/png;base64,YQ==');
    expect(html).toContain('<pre>boom &amp; more</pre>');
    expect(html).toContain('<pre class="note">new &amp; empty</pre>');
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

  it('says so when the pixels match but the markup differs', () => {
    const png = Buffer.from('a');
    const html = contactSheetHtml([
      [{ label: 'a vs merged', before: png, after: png, over: 'a', markupDiffers: true }],
    ]);

    expect(html).toContain('<figure data-diff data-over="a" data-markup-differs>');
    expect(html).toContain('<pre class="same">no pixel change, but the markup differs</pre>');
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
      boxes: [{ x: 1, y: 0, width: 1, height: 1 }],
    });
  });

  it('counts a pixel only one side covers as changed', () => {
    const diff = diffPixelsOf(pixels(1, 1, [9, 9, 9, 255]), pixels(1, 2, [9, 9, 9, 255, 9, 9, 9, 255]));

    expect([diff.width, diff.height, diff.changed]).toEqual([1, 2, 1]);
  });

  it('boxes changed pixels that sit close together as one group, and gives no box without one', () => {
    const grey = [9, 9, 9, 255];
    const red = [255, 0, 0, 255];
    const before = pixels(3, 3, [...grey, ...grey, ...grey, ...grey, ...grey, ...grey, ...grey, ...grey, ...grey]);
    const after = pixels(3, 3, [...grey, ...red, ...grey, ...grey, ...grey, ...grey, ...grey, ...grey, ...red]);

    expect(diffPixelsOf(before, after).boxes).toEqual([{ x: 1, y: 0, width: 2, height: 3 }]);
    expect(diffPixelsOf(before, before).boxes).toEqual([]);
  });

  it('gives each of two changed regions far apart a box of its own', () => {
    const blank = () =>
      pixels(
        100,
        100,
        Array.from({ length: 100 * 100 * 4 }, () => 0),
      );
    const after = blank();

    for (const [x, y] of [
      [4, 4],
      [6, 7],
      [90, 92],
    ] as const) {
      after.data.set([255, 0, 0, 255], (y * 100 + x) * 4);
    }

    expect(diffPixelsOf(blank(), after).boxes).toEqual([
      { x: 4, y: 4, width: 3, height: 4 },
      { x: 90, y: 92, width: 1, height: 1 },
    ]);
  });

  it('runs from its own source, as the sheet page runs it', () => {
    const fromSource = new Function(`return ${diffPixelsOf.toString()}`)() as typeof diffPixelsOf;

    expect(fromSource(pixels(1, 1, [1, 2, 3, 4]), pixels(1, 1, [1, 2, 3, 4])).changed).toBe(0);
  });
});

describe('clusteredBoxesOf', () => {
  it('merges boxes at most the gap apart and keeps the others apart', () => {
    const boxes = [
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 26, y: 0, width: 10, height: 10 },
      { x: 0, y: 200, width: 10, height: 10 },
    ];

    expect(clusteredBoxesOf(boxes, { gap: 16 })).toEqual([
      { x: 0, y: 0, width: 36, height: 10 },
      { x: 0, y: 200, width: 10, height: 10 },
    ]);
    expect(clusteredBoxesOf(boxes, { gap: 15 })).toHaveLength(3);
  });

  it('widens the gap until no more than the cap remain', () => {
    const noise = Array.from({ length: 50 }, (_, index) => ({ x: index * 40, y: 0, width: 1, height: 1 }));

    expect(clusteredBoxesOf(noise, { gap: 16, max: 4 }).length).toBeLessThanOrEqual(4);
  });
});

describe('changedCropsOf', () => {
  const frame = { width: 1440, height: 900 };

  it('pads each box by the margin and merges crops that touch', () => {
    expect(
      changedCropsOf({
        boxes: [
          { x: 2, y: 3, width: 1, height: 1 },
          { x: 5, y: 1, width: 1, height: 1 },
          { x: 600, y: 400, width: 10, height: 10 },
        ],
        frame,
        margin: 1,
      }),
    ).toEqual([
      { x: 1, y: 0, width: 6, height: 5 },
      { x: 599, y: 399, width: 12, height: 12 },
    ]);
  });

  it('clamps the padded box to the frame', () => {
    expect(changedCropsOf({ boxes: [{ x: 1430, y: 4, width: 6, height: 6 }], frame })).toEqual([
      { x: 1414, y: 0, width: 26, height: 26 },
    ]);
  });

  it('converts picture pixels to CSS pixels at the scale, widening to whole pixels', () => {
    expect(
      changedCropsOf({ boxes: [{ x: 101, y: 40, width: 3, height: 1 }], frame: { width: 400, height: 200 }, scale: 2 }),
    ).toEqual([{ x: 34, y: 4, width: 34, height: 33 }]);
  });

  it('gives no crop without a box', () => {
    expect(changedCropsOf({ boxes: [], frame })).toEqual([]);
  });
});

describe('pngSizeOf', () => {
  it('reads the size from the header', () => {
    const header = Buffer.alloc(24);

    header.writeUInt32BE(1440, 16);
    header.writeUInt32BE(900, 20);

    expect(pngSizeOf(header)).toEqual({ width: 1440, height: 900 });
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

describe('changedBoxesOf', () => {
  it('opens no page for equal pictures', async () => {
    const browser = { newContext: vi.fn() } as unknown as Browser;

    expect(await changedBoxesOf({ browser, before: Buffer.from('a'), after: Buffer.from('a') })).toEqual([]);
    expect(browser.newContext).not.toHaveBeenCalled();
  });

  it('diffs both pictures in a page, clusters the groups and closes the context', async () => {
    const page = {
      evaluate: vi.fn().mockResolvedValue([
        { x: 1, y: 2, width: 3, height: 4 },
        { x: 10, y: 2, width: 3, height: 4 },
        { x: 300, y: 2, width: 3, height: 4 },
      ]),
    };
    const context = { newPage: vi.fn().mockResolvedValue(page), close: vi.fn() };
    const browser = { newContext: vi.fn().mockResolvedValue(context) } as unknown as Browser;

    expect(await changedBoxesOf({ browser, before: Buffer.from('a'), after: Buffer.from('b') })).toEqual([
      { x: 1, y: 2, width: 12, height: 4 },
      { x: 300, y: 2, width: 3, height: 4 },
    ]);
    expect(page.evaluate.mock.calls[0]?.[0]).toContain('function diffPixelsOf');
    expect(page.evaluate.mock.calls[0]?.[0]).toContain('data:image/png;base64,YQ==');
    expect(context.close).toHaveBeenCalled();
  });
});
