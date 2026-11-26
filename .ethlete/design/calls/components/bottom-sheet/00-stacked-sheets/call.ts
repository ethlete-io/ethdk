import { defineCall } from '@design-explore';

export default defineCall({
  stage: 'sketch',
  feature: 'Bottom sheet',
  eyebrow: 'Components · bottom sheet · sketch',
  headline: 'What the open sheet does when a second bottom sheet opens on top of it',
  intro:
    'Tap "Choose a date" to stack the second sheet, and "Done" to close it. The second sheet always docks 10px below the first one. The page behind stays as it is, because the page recede was rejected on 2026-10-24.',
  frameWidth: 420,
  variants: [
    {
      key: 'a',
      name: 'iOS: scale, lift and dim',
      claim: 'The first sheet scales to 0.92, lifts 10px so its top peeks out, and darkens. This is what iOS does.',
      cost: 'A transform and a scrim on the lower sheet; the scrim has to cover its content.',
      verdict: 'chosen',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      name: 'Scale and lift, no dim',
      claim: 'The same scale and lift, but the first sheet keeps its colours.',
      cost: 'Less depth: the two sheets read as one colour on the same surface.',
      verdict: 'rejected',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      name: 'Dim only, no scale',
      claim: 'The first sheet stays in place and only darkens. Its top shows 10px above the second sheet.',
      cost: 'No motion on the lower sheet; the peek is thin and reads as a flat stack.',
      verdict: 'rejected',
      load: () => import('./variant-c'),
    },
  ],
});
