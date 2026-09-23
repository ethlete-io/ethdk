import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Timeline · reference',
  headline: 'The same block at every length',
  intro:
    'One block drawn at 15, 30, 45, 60, 120 and 180 minutes, at the 8rem per hour the sketch uses. It drops its detail line under 5rem and its padding under 2.2rem. This is the earlier block sketch that the kerbe band replaced, kept as a picture to compare against.',
  frameWidth: 1504,
  variants: [
    {
      key: 'durations',
      name: 'The block, length by length',
      load: () => import('./variant-durations'),
    },
  ],
});
