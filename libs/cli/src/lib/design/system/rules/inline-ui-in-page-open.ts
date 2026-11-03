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
    anchor: 'row',
    kind: 'role="button"',
    count: 1,
    owner: 'B248a',
  },
  {
    product: 'studio',
    place: 'pages/inbox/shared/inbox.ts',
    anchor: 'controls',
    kind: '<et-switch>',
    count: 1,
    owner: 'B248a',
  },
  {
    product: 'studio',
    place: 'pages/inbox/shared/inbox.ts',
    anchor: 'retry',
    kind: '<button>',
    count: 1,
    owner: 'B248a',
  },
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
    place: 'pages/merge/merge.ts',
    anchor: 'listRow',
    kind: 'tabindex',
    count: 1,
    owner: 'B248a',
  },
  {
    product: 'studio',
    place: 'pages/merge/merge.ts',
    anchor: 'loading',
    kind: '<button>',
    count: 1,
    owner: 'B248a',
  },
  {
    product: 'studio',
    place: 'pages/sketches/shared/sketch-status.ts',
    anchor: 'holdTrigger',
    kind: '<button>',
    count: 1,
    owner: 'B248a',
  },
  {
    product: 'studio',
    place: 'pages/system/system.ts',
    anchor: 'commentTarget',
    kind: 'role="button"',
    count: 1,
    owner: 'B248a',
  },
  {
    product: 'studio',
    place: 'pages/system/system.ts',
    anchor: 'loading',
    kind: '<button>',
    count: 1,
    owner: 'B248a',
  },
  {
    product: 'studio',
    place: 'pages/system/system.ts',
    anchor: 'commentDraft',
    kind: '<textarea>',
    count: 2,
    owner: 'B248b',
  },
  {
    product: 'studio',
    place: 'pages/system/shared/capabilities.ts',
    anchor: 'act',
    kind: '<button>',
    count: 1,
    owner: 'B248a',
  },
  {
    product: 'studio',
    place: 'pages/system/shared/capabilities.ts',
    anchor: 'titled',
    kind: '<button>',
    count: 1,
    owner: 'B248a',
  },
];
