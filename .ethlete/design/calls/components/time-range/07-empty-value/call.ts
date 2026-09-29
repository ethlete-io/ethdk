import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'The time range picker',
  eyebrow: 'Components · call 7',
  headline: 'The ring before a time is picked',
  intro:
    'No call so far drew a ring without a value. Every frame draws an empty range with the "from" field focused, at 14:10 local time. In every variant a tap on the track places the handle of the focused field there, and a range then moves focus to "to".',
  frameWidth: 360,
  rounds: [
    {
      key: 'r1',
      title: 'An empty ring',
      note: 'A won: no handle and no arc until a tap, and the centre shows --:-- with a hint. B guesses a default that reads as a set value, and C puts a control in the centre.',
    },
  ],
  variants: [
    {
      key: 'a',
      verdict: 'chosen',
      round: 'r1',
      name: 'A · An empty ring',
      claim: 'No handle and no arc. The centre shows --:-- and a short hint, so the ring shows that nothing is set.',
      cost: 'The first pick is a tap, not a drag, and the hint is one more label to translate.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'rejected',
      round: 'r1',
      name: 'B · Dashed handles at now',
      claim:
        'Dashed handles sit at now and one hour later, the common start of a new range. A drag on one makes it real.',
      cost: 'A reader can take the dashed handles for a set value, and the default of one hour is a guess.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      verdict: 'rejected',
      round: 'r1',
      name: 'C · A Now button in the centre',
      claim: 'The empty ring holds a Now button. A tap sets the focused end to now, snapped to minuteStep.',
      cost: 'The centre holds a control, and it shows no time until a pick.',
      load: () => import('./variant-c'),
    },
  ],
});
