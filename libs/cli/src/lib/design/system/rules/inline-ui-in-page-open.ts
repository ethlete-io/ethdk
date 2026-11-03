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

export const OPEN_INLINE_UI: OpenInlineUi[] = [
  {
    product: 'studio',
    place: 'pages/inbox/shared/inbox.ts',
    anchor: 'dialog',
    kind: '<et-textarea>',
    count: 1,
    owner: 'B248b',
  },
  {
    product: 'studio',
    place: 'pages/inbox/shared/inbox.ts',
    anchor: 'dialog',
    kind: '<button>',
    count: 1,
    owner: 'B248b',
  },
  {
    product: 'studio',
    place: 'pages/inbox/shared/inbox.ts',
    anchor: 'editor',
    kind: '<button>',
    count: 1,
    owner: 'B248b',
  },
  {
    product: 'studio',
    place: 'pages/system/system.ts',
    anchor: 'commentDraft',
    kind: '<textarea>',
    count: 2,
    owner: 'B248b',
  },
];
