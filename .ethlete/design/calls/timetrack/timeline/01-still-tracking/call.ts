import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Timeline · call 1',
  headline: 'How a growing call row shows the part still being added',
  intro:
    'A call row grows as long as Discord holds the microphone, so a meeting that ended at 14:45 keeps booking the small talk after it. Each variant draws the same slice of the Calls & meetings lane at the app’s 8rem per hour: FIP-3095 from 14:00, its meeting over at 14:45, now 15:00. Left, the row still growing, with a way to snip it at the meeting’s end. Right, the row snipped the way endRowAt does it - the rest comes back as an unnamed call band - with a way to let the row follow the call again.',
  frameWidth: 760,
  variants: [
    {
      key: 'a',
      verdict: 'rejected',
      name: 'A · A breathing tail inside the band',
      claim:
        'The live minutes stay part of the band and are hatched and breathe in opacity, with a scissors chip on the join, so the band’s length still equals its booked length and the snip has one obvious target.',
      cost: 'Hatching inside a band already means a break it overlaps, and the tail is the one thing on the day that never stops moving.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'rejected',
      name: 'B · A live rail below the band',
      claim:
        'The settled part is a normal band; the live part is a thin rail hanging off it past a small gap, labelled “+15m live” with a × to cut it, so what is still open reads as not yet the row’s.',
      cost: 'The band now looks 45m long while its label says 1h 0m, and the rail is a second shape the lane has to learn.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      verdict: 'chosen',
      name: 'C · A fading tail with a cut line',
      claim:
        'The band fades out past the meeting’s end, and a dashed line on the join is the cut: press it to end there, drag it to end elsewhere, and after the cut it stays as a seam with a ↺.',
      cost: 'A drag on that line does what dragging the band’s end already does, so one edge carries two gestures, and the fade leaves the band without a bottom edge.',
      load: () => import('./variant-c'),
    },
  ],
});
