# Floating action

Keeps an action reachable after the reader has scrolled past it. The trigger sits in the flow where you wrote it,
and pins itself to a corner of the viewport once its place in the page has scrolled away — a filter button above
a long list, a save bar, a back-to-top.

Import `FLOATING_ACTION_IMPORTS`. No provider, no default component: the trigger is your own button.

```html
<div etFloatingAction>
  <div etFloatingActionAnchor>
    <button (click)="openFilters()" et-button etFloatingActionTrigger>Filter</button>
  </div>

  <ul etFloatingActionScope>
    @for (result of results(); track result.id) {
    <li>…</li>
    }
  </ul>
</div>
```

## Live demo

<StoryEmbed id="components-floating-action--default" height="520px" />

## Anatomy

Four parts, of which two are optional:

| Part                        | Required | What it is                                                                |
| --------------------------- | -------- | ------------------------------------------------------------------------- |
| `[etFloatingAction]`        | yes      | The coordinator. Wraps everything and publishes the state.                |
| `[etFloatingActionAnchor]`  | yes      | The trigger's home in the flow. Its visibility drives everything.         |
| `[etFloatingActionTrigger]` | yes      | The button itself.                                                        |
| `[etFloatingActionScope]`   | no       | The region the action acts on. Bounds where the trigger keeps floating.   |
| `[etFloatingActionTop]`     | no       | Where `scrollToTop()` goes. Defaults to the `[etFloatingAction]` element. |

**The anchor has to be a separate element from the trigger**, and that is the whole trick. Once the trigger is
`position: fixed` it is _always_ on screen, so observing it would say "come back", then "go away", forever. The
anchor never moves, so its visibility is a stable question — and it keeps the trigger's space in the flow, so
nothing jumps when the trigger detaches.

## Three states

The host publishes `data-state`, and `state()` returns the same thing:

| State      | When                                                   | What the trigger does                      |
| ---------- | ------------------------------------------------------ | ------------------------------------------ |
| `inline`   | the anchor is on screen, or still below the fold       | sits where it was written                  |
| `floating` | the anchor has scrolled **above**, scope still in play | `position: fixed`, scaled in at the corner |
| `hidden`   | the scope has scrolled above too                       | scaled out, and `visibility: hidden`       |

Note that it is _above_, not merely "not visible". An anchor still below the fold has simply not been reached
yet, and pinning the trigger then would put it on screen before the reader ever got to it.

Without a scope, `hidden` never happens and the trigger floats for the rest of the page. Add one when the action
stops making sense past a point — a pinned "Filter" button following the reader down into a footer is clutter.

::: tip Why not `position: sticky`?
Sticky can hold an element at an edge, but it can't move it to a corner of the viewport, and it has no way to
express "and the region this acts on is still on screen" — which is the part that keeps the button from following
the reader onto unrelated content. So the state comes from two intersection observers and CSS reacts to it.
:::

## `scrollToTop()`

What a filter button does after applying: send the reader back to the first result rather than leaving them
wherever they were.

```html
<div #fa="etFloatingAction" etFloatingAction>
  <h2 etFloatingActionTop>Results</h2>

  <div etFloatingActionAnchor>
    <button (click)="apply(); fa.scrollToTop()" et-button etFloatingActionTrigger>Filter</button>
  </div>
  …
</div>
```

Smooth-scrolls by default; pass `ScrollIntoViewOptions` to change that.

## Options

| Input      | Type      | Default | Purpose                                                    |
| ---------- | --------- | ------- | ---------------------------------------------------------- |
| `disabled` | `boolean` | `false` | Keep the trigger in the flow whatever the scroll position. |

| Member            | Type                                  | Purpose                                  |
| ----------------- | ------------------------------------- | ---------------------------------------- |
| `state()`         | `Signal<FloatingActionState>`         | `'inline'`, `'floating'` or `'hidden'`.  |
| `isFloating()`    | `Signal<boolean>`                     | Whether the trigger is pinned right now. |
| `scrollToTop(o?)` | `(o?: ScrollIntoViewOptions) => void` | Scroll back to the top of the region.    |

`disabled` is the escape hatch for turning the behaviour off per breakpoint or per route without unwinding the
markup — a desktop layout that already shows its filters in a sidebar has nothing to float.

## Accessibility

**The trigger is the same element in all three states.** It is never duplicated, never re-rendered, never moved
in the DOM — only its CSS position changes. So the tab order does not change as the reader scrolls, and a screen
reader never announces a button appearing or disappearing.

In the `hidden` state the trigger gets `visibility: hidden`, not merely `scale: 0`. A zero-scale button is still
focusable, so tabbing would otherwise land on something invisible. The visibility change is delayed to the end of
the scale-out so the animation stays watchable.

A floating trigger overlaps content by design. If it covers something interactive at the bottom of your page, add
bottom padding to the scrolling region — the component can't know what's underneath it.

Both the scale-in and scale-out are inside `@media (prefers-reduced-motion: no-preference)`; a reader who asks
for less motion gets the position change without the animation.

## Theming

Nothing is painted here — the trigger is your button (usually [`et-button`](/components/button) or its FAB
variant), and this domain only changes where it sits.

| Token                                   | Default | Purpose                                                 |
| --------------------------------------- | ------- | ------------------------------------------------------- |
| `--et-floating-action-inset-inline-end` | `24px`  | Distance from the inline edge while floating.           |
| `--et-floating-action-inset-block-end`  | `24px`  | Distance from the bottom, **plus** the safe-area inset. |
| `--et-floating-action-z-index`          | `10`    | Stacking order of the floating trigger.                 |
| `--et-floating-action-duration`         | `200ms` | Scale in/out duration.                                  |

The bottom offset adds `env(safe-area-inset-bottom)`, so the trigger clears a phone's home bar without
per-platform configuration.

## Error codes

Floating action throws in the `ET41xx` range — see [error codes](/components/error-codes#floating-action-et41xx).

::: info Migrating from `@ethlete/cdk`
This replaces cdk's `rich-filter`, which was never about filtering — it rendered no filter UI and imported
nothing from `@ethlete/query`. The renames: `et-rich-filter-host` → `[etFloatingAction]`,
`et-rich-filter-button-slot` → `[etFloatingActionAnchor]`, `etRichFilterButton` → `[etFloatingActionTrigger]`,
`etRichFilterContent` → `[etFloatingActionScope]`, `etRichFilterTop` → `[etFloatingActionTop]`.

cdk exposed ten boolean state classes (`--is-above`, `--is-visible`, … for both observed elements) and left the
combining to your CSS. This publishes the one derived answer as `data-state` instead.
:::
