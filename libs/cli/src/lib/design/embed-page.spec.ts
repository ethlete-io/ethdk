// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { embedPage, embedSearchOf, fitEmbed } from '../../../design/embed-page';

describe('embedPage', () => {
  it('keeps the product, sketch variant and theme of the embedding frame', () => {
    const search = new URLSearchParams(
      embedSearchOf({
        page: 'pages/system',
        state: 'open',
        current: '?product=studio&part=pages/inbox&state=default&sketch=pages/inbox&variant=b&surface=dark&fit=1',
      }),
    );

    expect(Object.fromEntries(search)).toEqual({
      product: 'studio',
      sketch: 'pages/inbox',
      variant: 'b',
      surface: 'dark',
      part: 'pages/system',
      state: 'open',
    });
  });

  it('draws a frame at the given viewport, scaled in a box of the scaled size', () => {
    const plain = document.createElement('div');
    const scaled = document.createElement('div');

    plain.innerHTML = embedPage('pages/system', { width: 800, height: 600 }).body;
    scaled.innerHTML = embedPage('pages/system', { width: 800, height: 600, scale: 0.5 }).body;

    const frame = plain.querySelector('iframe');

    expect(frame?.getAttribute('src')).toContain('part=pages%2Fsystem');
    expect(frame?.style.width).toBe('800px');
    expect(frame?.style.height).toBe('600px');
    expect((scaled.firstElementChild as HTMLElement).style.height).toBe('300px');
    expect(scaled.querySelector('iframe')?.style.transform).toBe('scale(0.5)');
  });

  it('grows an auto-height frame and its box when the embedded page measures itself', () => {
    const host = document.createElement('div');

    host.innerHTML = embedPage('pages/system', { height: 'auto', scale: 0.5 }).body;

    const frame = host.querySelector('iframe') as HTMLIFrameElement;

    fitEmbed(frame, 900);

    expect(frame.style.height).toBe('900px');
    expect((host.firstElementChild as HTMLElement).style.height).toBe('450px');
    expect(frame.hasAttribute('data-et-embed-drawn')).toBe(true);
    expect(() => fitEmbed(null, 10)).not.toThrow();
  });
});
