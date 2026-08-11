# Progress steps

`et-progress-steps` lays out a row of `et-progress-step`s for a wizard or multi-step flow - each step gets a numbered marker (a checkmark once complete), a label, and a connecting line to its neighbor, all without a single line of layout math. Distinct from `et-number-input`'s `stepper` input (the −/+ increment buttons) - unrelated concept, unrelated name on purpose. Import `PROGRESS_STEPS_IMPORTS`.

```ts
import { PROGRESS_STEPS_IMPORTS } from '@ethlete/components';
```

```html
<et-progress-steps>
  <et-progress-step state="complete">Account</et-progress-step>
  <et-progress-step state="complete">Shipping</et-progress-step>
  <et-progress-step state="current">Payment</et-progress-step>
  <et-progress-step state="upcoming">Review</et-progress-step>
</et-progress-steps>
```

## Live demo

<StoryEmbed id="components-progress-steps--default" height="140px" />

## `state` is yours to set, per step

Nothing is derived from a step's position or a "current index" - each `et-progress-step` reads its
own `state` (default `'upcoming'`). That keeps a skipped step, an out-of-order retry, or a branching
flow exactly as easy to render as a strictly linear wizard: set whatever `state` the step is actually
in, wherever it sits in the projected list.

| `state`      | Marker                   | Reads as                                                   |
| ------------ | ------------------------ | ---------------------------------------------------------- |
| `'upcoming'` | number, neutral          | not reached yet                                            |
| `'current'`  | number, accent outline   | where the flow is now                                      |
| `'complete'` | checkmark, accent fill   | done, in the surrounding color theme                       |
| `'success'`  | checkmark, success fill  | done with an outcome, in the app's `type: 'success'` theme |
| `'warning'`  | warning triangle, filled | done with an outcome, in the app's `type: 'warning'` theme |
| `'error'`    | cross, filled            | done with an outcome, in the app's `type: 'error'` theme   |

### Outcome states

`success`, `warning` and `error` are for a step that finished with a result worth reporting - an
import that failed, a validation that passed with caveats. They differ from `complete` in two ways:
each carries its own icon, so the outcome never rests on color alone, and each scopes the step to the
app's matching semantic color theme, so the marker, the label and the connector after it all recolor
together without you providing a theme yourself.

Only the theme a rendered step actually uses is resolved, so a flow that never fails does not oblige
the app to register a `type: 'error'` theme. A step that does use one and finds it unregistered
throws - the same contract `et-banner` has.

<StoryEmbed id="components-progress-steps--outcomes" height="140px" />

## The marker number and connector are pure CSS

`et-progress-steps` puts a CSS `counter-reset` on itself; each `et-progress-step` does
`counter-increment` and reads it back with `content: counter(...)` on its marker - so the numbering
follows DOM order automatically, with no self-registration or index tracked in JS. The connecting
line between two markers is a `::after` pseudo-element spanning from one step's center to the next's,
tinted with the color theme only where the step it's attached to is resolved (`complete`, or one of
the three outcome states) - the line says "the flow got past here".

## A column instead of a row

`orientation="vertical"` on `et-progress-steps` stacks the steps, puts each label beside its marker,
and turns the connector into a vertical bar hanging from one marker down to the next. It is not a
rotation of the horizontal connector - the geometry is its own - and the gap default grows to `20px`,
because in a column the gap _is_ the connector's length.

```html
<et-progress-steps orientation="vertical">
  <et-progress-step state="complete">Account</et-progress-step>
  <et-progress-step state="current">Shipping</et-progress-step>
  <et-progress-step state="upcoming">Payment</et-progress-step>
</et-progress-steps>
```

<StoryEmbed id="components-progress-steps--vertical" height="220px" />

## Steps a user can go back to

A step is interactive when you write it as one. `et-progress-step` is also an attribute selector, so
put it on your own `<a>` or `<button>` and everything that belongs to you - `routerLink`, `href`, a
click handler, `disabled` - stays where you wrote it:

```html
<et-progress-steps>
  <a [routerLink]="['/checkout/account']" state="complete" et-progress-step>Account</a>
  <a [routerLink]="['/checkout/shipping']" state="current" et-progress-step>Shipping</a>
  <!-- not reachable yet, so not a link -->
  <et-progress-step state="upcoming">Payment</et-progress-step>
</et-progress-steps>
```

The whole step becomes the target, and it picks up a hover treatment (marker border and label in the
foreground color) plus the library's focus ring. Mixing linked and plain steps in one row is the
normal case: only the steps behind the user are reachable.

## Options

### `et-progress-steps`

| Input         | Type                         | Default        | Description                                          |
| ------------- | ---------------------------- | -------------- | ---------------------------------------------------- |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | Whether the steps run across a row or down a column. |

### `et-progress-step`

| Input   | Type                                                                         | Default      | Description                                                                                            |
| ------- | ---------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------ |
| `state` | `'complete' \| 'current' \| 'upcoming' \| 'success' \| 'warning' \| 'error'` | `'upcoming'` | Drives the marker (number vs. icon), the connector tint, the label weight, and the step's color theme. |

## Accessibility

A plain step renders `<span>`s with no ARIA role or live region of its own - a static indicator has
nothing to announce beyond the labels' own text. If a step's completion should be announced as it
changes, wrap the group in your own `aria-live` region.

A step written as an `<a>` or `<button>` is keyboard-reachable and focus-ringed by virtue of being a
real link or button; nothing is layered on top of it, so its accessible name is the label you
projected, and a `disabled` button or `aria-disabled` link is inert exactly as it would be anywhere
else.

## Theming

Public design tokens: `--et-progress-steps-gap`, `--et-progress-step-marker-size`,
`--et-progress-step-label-font-size`.

`current`/`complete` markers, the connector after a resolved step, and the `current` label all read
from the ambient [color theme](/core/theming) (`--et-theme-color-primary-solid` /
`--et-theme-color-on-primary-solid`) - scope one with `[etProvideColor]` the same way any other
component in this library picks up an accent. `upcoming` markers and the base connector use the
neutral surface border/text tokens instead, so an unthemed step never reads as colored.

The three outcome states provide their own color scope on the step, so those same tokens resolve to
the semantic theme rather than the ambient one - there is no separate set of error/warning/success
variables to override. Their labels use `--et-theme-color-ink-solid`, the tint meant for text rather
than for a fill.
