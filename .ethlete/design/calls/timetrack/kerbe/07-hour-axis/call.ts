import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Kerbe · call 7',
  headline: 'What the axis gives the reader to measure with',
  intro:
    'The app books in 15m increments, and the axis marks only the hour. Three of every four band edges therefore meet no mark at all. Every frame draws the same day, with the break as call 6 settled it, and changes one thing: what the axis says between one hour label and the next. The gutter is 5rem in all four, and how wide it should be is a separate question.',
  frameWidth: 1100,
  variants: [
    {
      key: 'a',
      name: 'A · The hour alone',
      claim:
        'What the app draws today. One 1px line at 5% white runs the full width at each hour, and nothing marks anything between them.',
      cost: 'A band that starts at 09:45 meets no mark, so the reader counts the quarter by eye against a band four lanes away.',
      verdict: 'rejected',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      name: 'B · Quarter ticks in the gutter',
      claim:
        'The field keeps the hour line and nothing else. Each 15m step gets a 0.5rem tick at the right edge of the gutter, 0.9rem at the half hour, so the scale sits where no band can cover it.',
      cost: 'The measure is away from the band, so a lane on the right is read across the day. The break block owns the gutter for its own height and takes the ticks out there.',
      verdict: 'chosen',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      name: 'C · The half hour crosses the field',
      claim:
        'B, and the half hour also draws a line at 3% white across the whole field, so a band longer than an hour has a mark at its middle.',
      cost: 'Twice as many lines behind the bands. Call 5 threw out a wash behind a band because it makes a claim there; a line is quieter, but it is the same place.',
      verdict: 'rejected',
      load: () => import('./variant-c'),
    },
    {
      key: 'd',
      name: 'D · The gutter is a ruler, the field is clean',
      claim:
        'Nothing crosses the field at all. The gutter carries the whole scale: a 2px notch at the hour, 1rem at the half, 0.5rem at the quarter.',
      cost: 'With no line running across, a band in the rightmost lane cannot be lined up with a time at a glance. It is the most on-brand and the least useful at width.',
      verdict: 'rejected',
      load: () => import('./variant-d'),
    },
  ],
});
