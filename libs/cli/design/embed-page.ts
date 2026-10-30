import { Drawing } from './define-call';

/**
 * How a page embeds another: the `state` to draw, the viewport `width` and `height` it is drawn at (`'auto'` grows
 * the frame to the page's content), and the `scale` the frame is shown at. Inside the embedded page, `mark` rings
 * every element matching its selector (each gets `data-et-embed-marked`), and `css` is added as a stylesheet.
 */
export type EmbedPageOptions = {
  state?: string;
  width?: number;
  height?: number | 'auto';
  scale?: number;
  mark?: string;
  css?: string;
};

const MARK_CSS =
  '[data-et-embed-marked] { outline: 0.2rem solid var(--et-theme-color-primary-solid, Highlight); outline-offset: 0.2rem; }';

const KEPT = ['product', 'sketch', 'variant', 'surface', 'color'];

/** The frame address of `page` in `state`, in the product, sketch variant and theme of the frame at `current`. */
export const embedSearchOf = (options: { page: string; state: string; current: string }) => {
  const current = new URLSearchParams(options.current);
  const search = new URLSearchParams();

  for (const key of KEPT) {
    const value = current.get(key);

    if (value !== null) search.set(key, value);
  }

  search.set('part', options.page);
  search.set('state', options.state);

  return search.toString();
};

const attribute = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * Draws another page of the product inside a page, in a frame of its own, so a page shows a page in context without
 * importing it. The embedded page draws as the embedding frame does: the same product, sketch variant and theme.
 * Put the answer's `body` into the page's markup; it needs no styles or setup.
 */
export const embedPage = (page: `pages/${string}`, options: EmbedPageOptions = {}): Drawing => {
  const { state = 'default', width = 1280, height = 800, scale = 1, mark, css } = options;
  const search = embedSearchOf({ page, state, current: globalThis.location?.search ?? '' });
  const auto = height === 'auto';
  const frameHeight = auto ? 0 : height;
  const inside = `${mark ? ` data-et-embed-mark="${attribute(mark)}"` : ''}${css ? ` data-et-embed-css="${attribute(css)}"` : ''}`;
  const frame = `<iframe data-et-embed="${attribute(page)}" data-et-embed-scale="${scale}"${auto ? ' data-et-embed-height="auto"' : ''}${inside} title="${attribute(page)}" src="/frame.html?${attribute(search)}" style="display:block;border:0;width:${width}px;height:${frameHeight}px;transform:scale(${scale});transform-origin:0 0"></iframe>`;

  return {
    body:
      scale === 1
        ? frame
        : `<div data-et-embed-box style="overflow:hidden;width:${width * scale}px${auto ? '' : `;height:${frameHeight * scale}px`}">${frame}</div>`,
    styles: '',
  };
};

/**
 * Called by an embedded frame each time it measures itself: marks its iframe drawn and, for `height: 'auto'`, grows
 * the iframe (and the box of a scaled one) to `height`. Does nothing in a frame no page embeds.
 */
export const fitEmbed = (embed: Element | null, height: number) => {
  if (!(embed as HTMLElement | null)?.hasAttribute('data-et-embed')) return;

  const frame = embed as HTMLElement;

  if (frame.dataset['etEmbedHeight'] === 'auto') {
    frame.style.height = `${height}px`;

    const box = frame.parentElement;

    if (box?.hasAttribute('data-et-embed-box'))
      box.style.height = `${height * Number(frame.dataset['etEmbedScale'] ?? 1)}px`;
  }

  frame.dataset['etEmbedDrawn'] = '';
};

/**
 * Called by an embedded frame after it draws and on each change of its content: adds the `css` of its `embedPage`
 * once and marks every element in `root` that matches its `mark`. Does nothing in a frame no page embeds.
 */
export const applyEmbed = (embed: Element | null, root: HTMLElement) => {
  if (!(embed as HTMLElement | null)?.hasAttribute('data-et-embed')) return;

  const { etEmbedMark: mark, etEmbedCss: css } = (embed as HTMLElement).dataset;
  const document = root.ownerDocument;

  if ((mark || css) && !document.querySelector('style[data-et-embed-css]')) {
    const style = document.createElement('style');

    style.dataset['etEmbedCss'] = '';
    style.textContent = `${mark ? MARK_CSS : ''}\n${css ?? ''}`;
    document.head.append(style);
  }

  if (mark) for (const element of root.querySelectorAll(mark)) element.setAttribute('data-et-embed-marked', '');
};
