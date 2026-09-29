import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'The time range picker',
  eyebrow: 'Components · call 3',
  headline: 'How the ring shows time you cannot pick',
  intro:
    'The picker takes min, max and a timeFilter. Every frame draws 10:30 with min 08:00, max 20:00 and a filter that blocks 12:00 to 13:00, so the ring holds one span past midnight and one inside the day. In every variant a drag stops at the edge of a blocked span.',
  frameWidth: 360,
  variants: [
    {
      key: 'a',
      verdict: 'rejected',
      name: 'A · The track narrows',
      claim:
        'A blocked span keeps a thin track, so the ring stays whole and the open time is the wide part a finger can hold.',
      cost: 'A thin track can read as a style and not as a rule, so it says less than the other two.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'rejected',
      name: 'B · The track is hatched',
      claim:
        'A blocked span keeps its full width under a diagonal hatch, the common sign for time that is not available in a calendar.',
      cost: 'The hatch is the busiest mark in the frame, and at 12:00 to 13:00 it is small and looks like noise.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      verdict: 'chosen',
      name: 'C · Only the open time has a track',
      claim:
        'The track exists only where a time can be picked. A blocked span is a dotted line, so the ring shows the open time as two bands.',
      cost: 'The ring breaks into pieces, and a day that blocks many short spans turns into a row of dashes.',
      load: () => import('./variant-c'),
    },
  ],
});
