import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'Calendar contrast',
  eyebrow: 'Components · calendar · call 0',
  headline: 'Do the calendar outside dates and week numbers follow the scheduler?',
  intro:
    'The calendar draws dates outside the shown month and the week numbers in the subtle surface colour, the same as the scheduler month view did before scheduler-contrast call 1. Axe fails 39 nodes on the dark calendar stories at 3.78:1. Disabled dates also use subtle; WCAG exempts inactive controls, so they stay out of this call. Each frame draws three weeks with week numbers on four surfaces.',
  frameWidth: 720,
  rounds: [
    {
      key: 'r1',
      title: 'Outside dates',
      note: 'B won: outside dates and week numbers take muted, the rule the scheduler took. A fails AA on all four surfaces.',
    },
  ],
  variants: [
    {
      key: 'a',
      verdict: 'rejected',
      round: 'r1',
      name: 'A · Shipped',
      claim: 'Outside dates and week numbers in the subtle colour.',
      cost: 'Under AA on all four surfaces. The calendar and the scheduler month view no longer match.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'chosen',
      round: 'r1',
      name: 'B · Muted, as the scheduler',
      claim: 'Outside dates and week numbers take the muted colour, the rule the scheduler took.',
      cost: 'The step to an in-month date gets smaller. Disabled dates stay subtle, so they read one step quieter than outside dates.',
      load: () => import('./variant-b'),
    },
  ],
});
