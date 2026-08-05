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
own `state` (`'complete' | 'current' | 'upcoming'`, default `'upcoming'`). That keeps a skipped step,
an out-of-order retry, or a branching flow exactly as easy to render as a strictly linear wizard: set
whatever `state` the step is actually in, wherever it sits in the projected list.

## The marker number and connector are pure CSS

`et-progress-steps` puts a CSS `counter-reset` on itself; each `et-progress-step` does
`counter-increment` and reads it back with `content: counter(...)` on its marker - so the numbering
follows DOM order automatically, with no self-registration or index tracked in JS. The connecting
line between two markers is a `::after` pseudo-element spanning from one step's center to the next's,
tinted with the app's color theme only where the step it's attached to is `complete`.

## Options

### `et-progress-step`

| Input   | Type                                    | Default      | Description                                                                         |
| ------- | --------------------------------------- | ------------ | ----------------------------------------------------------------------------------- |
| `state` | `'complete' \| 'current' \| 'upcoming'` | `'upcoming'` | Drives the marker (number vs. checkmark), the connector tint, and the label weight. |

`et-progress-steps` itself takes no inputs - project the steps in order.

## Accessibility

Both components render plain `<span>`s with no ARIA role or live region of their own - this is a
static, non-interactive indicator (not a step navigator you click through), so there is nothing to
announce beyond the labels' own text. If a step's completion should be announced as it changes,
wrap the group in your own `aria-live` region.

## Theming

Public design tokens: `--et-progress-steps-gap`, `--et-progress-step-marker-size`,
`--et-progress-step-label-font-size`.

`current`/`complete` markers, the connector to a `complete` step, and the `current` label all read
from the ambient [color theme](/core/theming) (`--et-theme-color-primary-solid` /
`--et-theme-color-on-primary-solid`) - scope one with `[etProvideColor]` the same way any other
component in this library picks up an accent. `upcoming` markers and the base connector use the
neutral surface border/text tokens instead, so an unthemed step never reads as colored.
