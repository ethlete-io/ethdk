import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'The line chart',
  eyebrow: 'Components · line chart · call 3',
  headline: 'How should a stacked area fill read on a dark surface, and still work on light?',
  intro:
    'Every frame draws the same stacked area chart twice, left on a light card and right on a dark card: active subscriptions in four plans over twelve months, coloured from the four chart colour themes of the app. The shipped line chart fills an area at 0.12 opacity, or 0.32 when stacked, so on dark each band is a dim film of its colour over the near-black surface, with the grid showing through.',
  frameWidth: 900,
  rounds: [
    {
      key: 'r1',
      title: 'Stacked area',
      note: 'B won: a stacked band fills with an opaque color-mix of 45% series colour with the surface, and the areas draw before the lines. One rule gives clean, flat bands on light and dark with no new theme field. A is muddy on dark, C needs a new surface theme field, and D makes the bands hard to tell apart near the baseline.',
    },
  ],
  variants: [
    {
      key: 'a',
      verdict: 'rejected',
      round: 'r1',
      name: 'A · Shipped',
      claim: 'Each stacked band fills with its series colour at 0.32 opacity, on any surface, under a 2px line.',
      cost: 'On dark the bands turn muddy and close in tone, and the grid lines cut through every band.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'chosen',
      round: 'r1',
      name: 'B · Opaque mix with the surface',
      claim:
        'A stacked band fills with color-mix of its series colour at 45% and the surface background, opaque; all areas draw first, then all lines.',
      cost: 'The fill hides the grid inside the stack, and the component changes its draw order; one mix ratio has to suit both surfaces.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      verdict: 'rejected',
      round: 'r1',
      name: 'C · Stronger opacity on dark',
      claim:
        'The surface theme carries the stacked fill opacity: 0.6 on a dark surface, the shipped 0.32 on light, which stays as it is.',
      cost: 'A new chart field on the surface theme that every app with a dark theme must set, and the grid still shows through.',
      load: () => import('./variant-c'),
    },
    {
      key: 'd',
      verdict: 'rejected',
      round: 'r1',
      name: 'D · Gradient to the baseline',
      claim:
        'Each band fades from 0.56 opacity at its top edge to 0.08 at the baseline, so the tops read strong and the stack stays light.',
      cost: 'An SVG gradient per series and chart instance, and the low ends of the upper bands fade, so a band reads less evenly as a block.',
      load: () => import('./variant-d'),
    },
  ],
});
