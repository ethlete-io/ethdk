/**
 * Inline UI a page may still hold until its owner item moves it into a part: `count` hits of `kind` inside the
 * declaration `anchor` of the file at `place` (product-relative). The list may only shrink.
 */
export type OpenInlineUi = {
  product: string;
  place: string;
  anchor: string;
  kind: string;
  count: number;
  owner: string;
};

export const OPEN_INLINE_UI: OpenInlineUi[] = [];
