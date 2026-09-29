import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'The time range picker',
  eyebrow: 'Components · call 0',
  headline: 'What the overlay shows that the input cannot',
  intro:
    'The input already shows both times, so the overlay must add something. Every frame draws the same overnight range, 22:00 to 06:30, with the "to" field focused. The overlay has no from and to toggle in B and C: the focused field picks the handle.',
  frameWidth: 360,
  rounds: [
    {
      key: 'r1',
      title: 'What the overlay adds',
      note: 'The ring won. It is the only one that draws a range past midnight as one piece and shows the duration. The toggle and the tint of A repeat what the input shows, and the split bar of C must be joined by the reader.',
    },
    {
      key: 'r2',
      title: 'The ring in a 12h locale',
      note: 'The ring stays 24h for a 12h locale, like the iOS Bedtime dial. E won: the moon and the sun show which half is night before a label is read.',
    },
  ],
  variants: [
    {
      key: 'a',
      verdict: 'rejected',
      round: 'r1',
      name: 'A · Today, redrawn',
      claim: 'The columns of today, with the from and to toggle and the range tint on the options.',
      cost: 'The tint marks hours 22 to 05 and minutes under 30 at once, so the reader cannot tell what the colour means. The toggle repeats the focus the input already has.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'chosen',
      round: 'r1',
      name: 'B · A 24h ring with two handles',
      claim:
        'One ring holds the whole day, so a range past midnight is one unbroken arc. The centre shows the duration, and a drag on either handle or on the arc sets the range fast.',
      cost: 'A drag snaps to the minute step, so an exact minute needs the input. The ring takes the most height of the three.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      verdict: 'rejected',
      round: 'r1',
      name: 'C · A 24h track with two handles',
      claim:
        'A flat bar from 00 to 24 with the duration above it. It is short, and a mouse drags along it with no curve to follow.',
      cost: 'A range past midnight breaks into two pieces at each end of the bar, so the reader must join them.',
      load: () => import('./variant-c'),
    },
    {
      key: 'd',
      verdict: 'rejected',
      round: 'r2',
      name: 'D · B with 12h labels',
      claim:
        'The ring stays 24h. Only the labels change: 12 AM at the top, 12 PM at the bottom, and 6 AM and 6 PM on the sides. The short numbers between them have no suffix.',
      cost: 'A 12h reader must learn that the ring holds a full day, and the two plain 3s and 9s look the same.',
      load: () => import('./variant-d'),
    },
    {
      key: 'e',
      verdict: 'chosen',
      round: 'r2',
      name: 'E · D with a moon and a sun',
      claim:
        'D, plus a small moon under 12 AM and a small sun above 12 PM. The two marks tell a 12h reader which half is night before a label is read.',
      cost: 'Two more marks sit inside the ring, and the sun is close to the centre text.',
      load: () => import('./variant-e'),
    },
  ],
});
