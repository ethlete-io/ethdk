# Masonry

Packs variable-height items into columns, each item going to whichever column is currently shortest. Reach for
it when the items genuinely differ in height and cropping them to a common height would lose something - a photo
feed, a card wall, user-submitted content. When the items are uniform, a CSS grid is simpler and cheaper; when
they scroll sideways, use the [carousel](/components/carousel).

Import `MASONRY_IMPORTS`. There is no provider to register.

```html
<ul [columnWidth]="240" [gap]="16" etMasonry>
  @for (photo of photos(); track photo.id) {
  <li etMasonryItem>
    <img [src]="photo.url" [style.aspect-ratio]="photo.ratio" alt="" />
    <p>{{ photo.caption }}</p>
  </li>
  }
</ul>
```

Masonry ships as directives only - there is no `<et-masonry>` element. The layout has no visual opinion to wrap
in a default component, and the element being yours is what lets the markup be a real list: `<ul>` plus `<li>`
needs no ARIA at all. The structural CSS the layout depends on is injected by the directive itself, so a
hand-built masonry behaves identically to the snippet above.

## Live demo

<StoryEmbed id="components-layout-masonry--default" height="560px" />

## How the layout works

Items are measured and then absolutely positioned. That is a deliberate choice, not a legacy one:

- **Native CSS masonry is not usable yet.** CSS Grid Level 3 (`display: grid-lanes`, previously
  `grid-template-rows: masonry`) is not Baseline - no engine ships it unflagged, and the syntax has changed
  twice. It will make this component unnecessary; it can't yet.
- **CSS `columns` fills column by column**, so the third item in the DOM appears at the top of the second
  column. A feed's reading order would no longer be its visual order, which breaks tab order and screen readers
  alike. This component keeps DOM order and reading order the same.

Because the items are out of flow, the container gets its height set from the tallest column, and a reflow
inside the masonry never relayouts the page around it.

### Columns come from the container, not from breakpoints

`columnWidth` is a **minimum**, not a target. The column count is as many columns of that width as fit, gaps
included, and the leftover space is shared out so the columns always fill the container - the arithmetic of
`repeat(auto-fill, minmax(240px, 1fr))`.

So a 1000px container at `columnWidth: 240` and `gap: 16` gives **three** columns of 322.67px: a fourth would
need `4 × 240 + 3 × 16 = 1008px`. The columns you get are never narrower than you asked for, which is the part
cdk got wrong - it divided without counting the gaps, so `columWidth: 250` in a 1000px container produced four
238px columns.

The count therefore follows the element's own width, so a masonry in a collapsing sidebar re-columns without a
media query. Both `columnWidth` and `gap` also accept a per-breakpoint map when the container width alone isn't
the whole story:

```html
<ul [columnWidth]="{ xs: 150, md: 240 }" [gap]="{ xs: 8, md: 16 }" etMasonry></ul>
```

### Items are measured continuously

Every item observes its own size, so content that arrives or changes after layout is handled: an image that
loads late, a description that expands on click, text that reflows when a translation swaps in. The items below
it move down.

<StoryEmbed id="components-layout-masonry--appending-items" height="560px" />

### A card changing height doesn't rearrange the grid

An item keeps the column it was first given for as long as the column count holds. Only its position _within_
that column is recomputed.

This matters because greedy packing is stable against items being _added_ but not against an existing item
changing _height_: a card growing changes which column is shortest for every item after it, so items would hop
columns because a paragraph two columns over expanded. Instead, growing a card pushes down only what is below it
in its own column.

The cost is that heights which change a lot after the first layout leave the columns less even than a fresh pack
would. Two things rebalance:

- a resize that changes the **column count** - the old assignments say nothing about a different grid, so it
  packs from scratch;
- **`repack()`**, the explicit escape hatch, for when you have replaced the content wholesale.

```ts
masonry = viewChild.required(MasonryDirective);

protected onDataReplaced() {
  this.masonry().repack();
}
```

### Appending items, and infinite scroll

Where an item lands depends only on the items before it, so appending a page re-derives the existing placements
_identically_ - nothing already on screen moves.

What does need care is _when_ you append. Fetching the next page while the current one is still being measured
appends items against heights that are about to change. `isSettled()` is the signal to gate on:

```html
<ul #masonry="etMasonry" [columnWidth]="240" etMasonry>
  @for (photo of photos(); track photo.id) {
  <li etMasonryItem>…</li>
  }
</ul>

<button [disabled]="!masonry.isSettled()" (click)="fetchNextPage()">Load more</button>
```

For a scroll-triggered loader, guard the fetch itself rather than the trigger:

```ts
protected onSentinelVisible() {
  if (!this.masonry().isSettled()) return;

  this.fetchNextPage();
}
```

::: tip Migrating from `@ethlete/cdk`
This replaces cdk's `injectInfinityQueryResponseDelay` handshake, which only ever existed for the legacy query
client. `isSettled()` is client-agnostic - gate the trigger on it whatever fetches your data.
:::

## Options

### `[etMasonry]`

| Input         | Type                              | Default | Purpose                                                                             |
| ------------- | --------------------------------- | ------- | ----------------------------------------------------------------------------------- |
| `columnWidth` | `number \| BreakpointMap<number>` | `250`   | Minimum column width in px. The count is how many fit; the width stretches to fill. |
| `gap`         | `number \| BreakpointMap<number>` | `16`    | Space between columns and between stacked items, in px.                             |

| Member         | Type                             | Purpose                                                                                         |
| -------------- | -------------------------------- | ----------------------------------------------------------------------------------------------- |
| `isSettled()`  | `Signal<boolean>`                | Every item has reported its size at the current column width. Gate fetches on this.             |
| `isResizing()` | `Signal<boolean>`                | The container changed width in the last 150ms. Items snap rather than animate while it is true. |
| `columns()`    | `Signal<MasonryColumns>`         | The grid in effect: `{ count, inlineSize }`. `count: 0` until the container has been measured.  |
| `blockSize()`  | `Signal<number>`                 | The container's height, i.e. the tallest column.                                                |
| `items()`      | `Signal<MasonryItemDirective[]>` | The items in DOM order, which is the order they are packed in.                                  |
| `repack()`     | `() => void`                     | Rebalance the columns from scratch.                                                             |

The host also carries `data-settled` and `data-resizing` attributes mirroring those signals, for styling.

### `[etMasonryItem]`

The item takes no inputs - it measures itself and reads its width and position from the masonry. cdk required a
`key` per item; nothing needs one here, because identity is the directive instance and size changes are observed
rather than announced.

| Member           | Type                               | Purpose                                                                      |
| ---------------- | ---------------------------------- | ---------------------------------------------------------------------------- |
| `placement()`    | `Signal<MasonryPlacement \| null>` | `{ column, inlineOffset, blockOffset }`, or `null` before the first layout.  |
| `isPlaced()`     | `Signal<boolean>`                  | The placement is current, i.e. derived from a height measured at this width. |
| `isPositioned()` | `Signal<boolean>`                  | The item has been placed at least once - sticky, and what reveals it.        |
| `blockSize()`    | `Signal<number>`                   | The measured height being packed with.                                       |

Items expose `data-column`, `data-positioned` and `data-can-move` for styling.

## Motion

Items fade in as they are first placed, one by one, so a feed reveals itself as it settles rather than after a
blank pause. They then animate between placements - when a resize re-columns, when a neighbour grows, when one
is removed.

Two things are deliberately _not_ animated:

- **The first placement.** The move transition is armed a frame after an item is placed, so nothing slides in
  from the container's corner.
- **Moves during a container resize.** The columns change on every frame of a window drag, and a transition
  retargeted every frame is one the items never finish - they trail behind the layout. While `isResizing()` is
  true, moves snap.

Everything is inside `@media (prefers-reduced-motion: no-preference)`, so a reader who asks for less motion gets
none of it - including the fade.

## Accessibility

DOM order is reading order: this is what the JS layout buys over CSS `columns`, and it means tab order and
screen-reader order match what is on screen.

`[etMasonry]` sets `role="list"` and `[etMasonryItem]` sets `role="listitem"`. The roles are explicit rather than
implied because the host element is yours - but prefer `<ul>` and `<li>` anyway, which say the same thing
natively (Safari drops list semantics from a `<ul>` with `list-style: none`, so the explicit role earns its keep
there too).

Items are never hidden or `inert`. Nothing about this layout takes an item off screen, so there is nothing to
hide.

In dev mode, a masonry that has children but no `etMasonryItem` among them throws rather than rendering
invisible content, and an `etMasonryItem` outside a masonry throws too.

## Theming

Masonry paints nothing - no colors, no borders, no surface of its own. The cards are yours, and their colors come
from the app-registered surface and color theme systems like anything else.

The only tokens it declares are for its motion:

| Token                          | Default    | Purpose                                        |
| ------------------------------ | ---------- | ---------------------------------------------- |
| `--et-masonry-move-duration`   | `150ms`    | How long an item takes to move to a new place. |
| `--et-masonry-move-easing`     | `ease-out` | The easing of that move.                       |
| `--et-masonry-appear-duration` | `200ms`    | The fade-in on first placement.                |

One structural constraint: don't put horizontal padding on the masonry element. Absolutely positioned children
are laid out from its padding box, so the columns would be measured against a width that includes the padding
and overflow it. Put the padding on a wrapper.

## Error codes

Masonry throws in the `ET39xx` range - see [error codes](/components/error-codes#masonry-et39xx).
