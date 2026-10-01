import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'The line chart',
  eyebrow: 'Components · line chart · call 8',
  headline: 'How should the keyboard-focused x read on dense data?',
  intro:
    'Every frame draws two series twice: 90 daily values, where one x gets about 7px of plot, then 12 monthly values, where it gets about 59px. One x is keyboard-focused in each. The shipped focus rings the whole slice target, a full-height rounded rect as wide as the stretch closer to that x than to its neighbours, and shows the crosshair and the series points. The focus colour is the chart scope primary; the token values stand in for an app light theme. Tooltips are left out.',
  frameWidth: 720,
  rounds: [
    {
      key: 'r1',
      title: 'Focus ring',
      note: 'B won: the focus ring is at least 12px wide and centred on the x. It is the smallest change from the shipped ring and reads the same on dense and sparse data. A shrinks to a thick line on daily data, C drops the ring, and D moves focus off the x.',
    },
  ],
  variants: [
    {
      key: 'a',
      verdict: 'rejected',
      round: 'r1',
      name: 'A · Shipped',
      claim:
        'A 2px primary ring, radius 4, around the full-height slice target, with the crosshair and the series points.',
      cost: 'On 90 daily values the ring is about 7px wide, so its two long sides nearly touch and it reads as a thick line, not a ring.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'chosen',
      round: 'r1',
      name: 'B · Ring at least 12px wide',
      claim:
        'The same ring, but never narrower than 12px, centred on the x; on dense data it overlaps the neighbouring slices.',
      cost: 'The ring covers about two neighbouring days, so it no longer marks exactly one slice; a small change to the shipped rect.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      verdict: 'rejected',
      round: 'r1',
      name: 'C · Primary crosshair and ringed points',
      claim:
        'No column ring: the crosshair turns 2px primary and each series point gets a 2px primary ring 4px outside it.',
      cost: 'The indicator is drawn on the data, so it changes shape with the values; the ring colour sits close to a series of the same hue.',
      load: () => import('./variant-c'),
    },
    {
      key: 'd',
      verdict: 'rejected',
      round: 'r1',
      name: 'D · Ring around the plot',
      claim:
        'The chart is one tab stop, so the whole plot gets a 2px primary ring 6px outside it, and the crosshair and points mark the x.',
      cost: 'The ring says the chart has focus, not which x; that rests on the 1px grey crosshair and the points, which are thin on their own.',
      load: () => import('./variant-d'),
    },
  ],
});
