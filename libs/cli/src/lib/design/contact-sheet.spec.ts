import { describe, expect, it, vi } from 'vitest';
import { contactSheetHtml, contactSheetOf } from './contact-sheet';
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

    const png = await contactSheetOf({ browser, rows: [[{ label: 'x', png: Buffer.from('a') }]] });

    expect(png.toString()).toBe('png');
    expect(page.setViewportSize).toHaveBeenCalledWith({ width: 900, height: 1 });
    expect(page.screenshot).toHaveBeenCalledWith({ fullPage: true, type: 'png' });
    expect(context.close).toHaveBeenCalled();
  });
});
