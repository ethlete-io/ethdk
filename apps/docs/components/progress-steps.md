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

## Options

### `et-progress-step`

| Input   | Type                                                                         | Default      | Description                                                                                            |
| ------- | ---------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------ |
| `state` | `'complete' \| 'current' \| 'upcoming' \| 'success' \| 'warning' \| 'error'` | `'upcoming'` | Drives the marker (number vs. icon), the connector tint, the label weight, and the step's color theme. |

`et-progress-steps` itself takes no inputs - project the steps in order.

## Accessibility

Both components render plain `<span>`s with no ARIA role or live region of their own - this is a
static, non-interactive indicator (not a step navigator you click through), so there is nothing to
announce beyond the labels' own text. If a step's completion should be announced as it changes,
wrap the group in your own `aria-live` region.

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
