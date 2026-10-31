import kbdBase from '../src/lib/kbd/kbd.component.css?inline';

export type KbdMockOptions = {
  /** The glyph printed on each keycap, in order, e.g. `['⌘', '⇧', 'Z']` for `mod+shift+z` on Apple. */
  keys: string[];
  /** Extra attributes on the kbd, e.g. design markers. */
  attributes?: string;
};

/** The stylesheet `kbd()` draws with: the real kbd CSS. */
export const kbdStyles = kbdBase;

/** Draws an `et-kbd` with one keycap per key as the component renders it, as HTML, without its visually hidden spoken label. */
export const kbd = (options: KbdMockOptions) => {
  const keys = options.keys.map((key) => `<kbd class="et-kbd-key" aria-hidden="true">${key}</kbd>`).join('');
  const attributes = [options.attributes, 'class="et-kbd"'].filter(Boolean);

  return `<et-kbd ${attributes.join(' ')}>${keys}</et-kbd>`;
};
