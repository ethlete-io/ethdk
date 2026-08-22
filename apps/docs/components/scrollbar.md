# Scrollbar

`et-scrollbar` draws a scrollbar for a container that already scrolls. The container keeps the
scrolling; the element only mirrors the offset and lets the pointer drag it. Reach for it when the
platform scrollbar is in the way - a panel with its own chrome, a track that has to look the same on
every OS, a dark surface a light-grey system bar clashes with. Import `SCROLLBAR_IMPORTS`.

For a horizontal rail with buttons, edge masks, snap and drag-to-scroll, use
[scrollable](/components/scrollable) instead - that one owns its scroll container.

```ts
import { SCROLLBAR_IMPORTS } from '@ethlete/components';
```

```html
<div class="relative">
  <div #list class="list">…</div>

  <et-scrollbar [for]="list" autoHide />
</div>
```

## Live demo

<StoryEmbed id="components-layout-scrollbar--default" height="360px" />

## How it works

The scrollbar reads the target's `clientHeight`/`scrollHeight` (or the inline pair) and its scroll
offset, then sizes and offsets the thumb. It writes an offset back in two cases only:

- a drag of the thumb, which writes the offset on every pointer move;
- a press on the track, which scrolls one viewport towards the press, the way a press beside a native
  thumb pages.

Everything else stays native. Wheel, touch, keyboard, `scrollIntoView()` and CSS scroll snap behave
exactly as they did, because the container is still the scroll container.

Pointing a scrollbar at a container adds the `et-scrollbar-host` class to it, which hides that
container's native scrollbar. The class is reference-counted, so a container with a scrollbar on each
axis keeps its native one hidden until both are gone.

## Placement

The element positions itself over the end edge of its containing block:
`inset-inline-end` for a vertical scrollbar, `inset-block-end` for a horizontal one. Give the element
that wraps the scroll container `position: relative`, and pad the container on that edge so the thumb
does not sit on the content.

It overlays the container rather than reserving a gutter, so nothing reflows when it appears. A
container that scrolls both ways gets two elements:

```html
<div class="relative">
  <div #grid class="grid-scroller">…</div>

  <et-scrollbar [for]="grid" autoHide />
  <et-scrollbar [for]="grid" orientation="horizontal" autoHide />
</div>
```

The two do not reserve a corner for each other - they meet and overlap in the end corner. Inset one of
them if that matters for your layout.

<StoryEmbed id="components-layout-scrollbar--both-axes-and-rtl" height="640px" />

## Right to left

A horizontal scrollbar reads the target's `direction`. In a right-to-left container the thumb starts
at the right edge and travels left, and a drag towards the left scrolls towards the end - the target's
`scrollLeft` counts down into negative numbers there, and the scrollbar reads only the magnitude.

The direction is read off the **target**, not off the scrollbar element, so the two may sit in
different subtrees.

## Options

| Input          | Type                                | Default      | Description                                                                                          |
| -------------- | ----------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| `for`          | `HTMLElement \| ElementRef \| null` | `null`       | The scroll container to mirror. A template reference variable on the element is the usual value.     |
| `orientation`  | `'vertical' \| 'horizontal'`        | `'vertical'` | Which axis of the target this scrollbar mirrors.                                                     |
| `autoHide`     | `boolean`                           | `false`      | Show the thumb only while the target scrolls, while the pointer is over it, and while it is dragged. |
| `minThumbSize` | `number`                            | `24`         | Shortest the thumb may get, in pixels, on a track much shorter than its content.                     |
| `disabled`     | `boolean`                           | `false`      | Hide the thumb and ignore the pointer.                                                               |

`autoHide` fades the thumb out 800 ms after the last scroll event. It stays out while the pointer is
over the target or over the scrollbar, and for as long as a drag runs.

<StoryEmbed id="components-layout-scrollbar--auto-hide" height="360px" />

## Building your own track

`etScrollbar` and `etScrollbarThumb` carry the whole behaviour and impose no markup. Use them when the
default track is not the shape you want:

```html
<div [for]="list" class="my-track" etScrollbar>
  <div class="my-thumb" etScrollbarThumb></div>
</div>
```

The directive exposes `geometry()` (`thumbSize`, `thumbOffset`, `progress`, `canScroll`),
`isVisible()`, `isDragging()` and `isRtl()` as signals, and writes
`--_et-scrollbar-thumb-size` / `--_et-scrollbar-thumb-offset` on its host element, plus a
`data-orientation` attribute and the `et-scrollbar--visible` / `et-scrollbar--dragging` classes.

The `et-scrollbar-host` rule that hides the native scrollbar ships with `<et-scrollbar>`. A headless
consumer that never renders the component has to declare it:

```css
.et-scrollbar-host {
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}
```

## Accessibility

The scrollbar carries no role and takes no focus, and it is deliberate. The container it mirrors is a
real scroll container: it is already reachable by keyboard, already scrolls with the arrow keys, Page
Up/Down, Home and End, and is already announced by assistive technology. A second focusable control
with `role="scrollbar"` would duplicate all of it and add a stop to the tab order that reaches nothing
new.

A press on the track or the thumb leaves focus exactly where it was, so scrolling a panel that
dismisses on focus loss - a menu, a cascader - does not close it mid-drag.

That leaves one thing for you: a scroll container needs `tabindex="0"` to be keyboard-reachable when
it holds no focusable content of its own. Browsers do this for you in some cases and not others, so
set it explicitly on a container of plain text or images.

## Theming

| Token                               | Default                                                               | Applies to                                    |
| ----------------------------------- | --------------------------------------------------------------------- | --------------------------------------------- |
| `--et-scrollbar-thickness`          | `12px`                                                                | The track's cross-axis size                   |
| `--et-scrollbar-thumb-thickness`    | `6px`                                                                 | The thumb's cross-axis size                   |
| `--et-scrollbar-thumb-radius`       | `999px`                                                               | The thumb's corner radius                     |
| `--et-scrollbar-fade-duration`      | `150ms`                                                               | The auto-hide fade and the thumb's hover tint |
| `--et-scrollbar-thumb-color`        | `color-mix(in srgb, --et-surface-interaction-solid 35%, transparent)` | The thumb's fill at rest                      |
| `--et-scrollbar-thumb-active-color` | `color-mix(in srgb, --et-surface-interaction-solid 60%, transparent)` | The thumb's fill hovered or dragged           |

The thumb's colour is mixed from the surface theme's `--et-surface-interaction-solid` by default, so it
follows whatever surface it sits on - override the two tokens above to paint it yourself. See
[theming](/core/theming) for how surface themes are registered; the SDK ships no theme names of its
own.

Under `prefers-reduced-motion: reduce` both transitions are dropped, so an auto-hiding thumb appears
and disappears at once.

## Error codes

The scrollbar throws in the `ET49xx` range - see
[error codes](/components/error-codes#scrollbar-et49xx).
