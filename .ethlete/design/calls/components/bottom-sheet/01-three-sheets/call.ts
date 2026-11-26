import { defineCall } from '@design-explore';

export default defineCall({
  stage: 'sketch',
  feature: 'Bottom sheet',
  eyebrow: 'Components · bottom sheet · sketch',
  headline: 'What the sheets below the second one do when a third bottom sheet opens',
  intro:
    'The stack from 00-stacked-sheets, now three deep. The sheets have different heights, as in the app: Filter is tall, Date and Time are shorter. Tap "Open next" twice, then "Close". Only the sheet that is two or more levels down changes between the variants.',
  frameWidth: 420,
  variants: [
    {
      key: 'a',
      name: 'Only the sheet directly below peeks',
      claim:
        'A sheet two or more levels down fades out behind the one above it, so one top edge always shows. This is what iOS shows.',
      cost: 'A deeper sheet is not visible until the sheets above it close.',
      verdict: 'rejected',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      name: 'Every lower sheet keeps its peek (shipped now)',
      claim: 'Each lower sheet scales and lifts the same way and stays visible at its own height.',
      cost: 'Sheets of different heights show uneven edges, and each backdrop darkens the deeper sheets more.',
      verdict: 'chosen',
      load: () => import('./variant-b'),
    },
  ],
});
