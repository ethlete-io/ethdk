import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Kerbe · call 9',
  headline: 'What the clock column costs the day',
  intro:
    'The gutter is 5rem wide and every label in it reads HH:00. Call 7 settled what the axis marks and left both untouched, so neither was ever designed. Every frame draws the same day, with the axis as call 7 settled it and the header as call 8 settled it. Only the gutter changes: how wide it is, and what the label in it says. The width and the label are one answer, because the label is what fits.',
  frameWidth: 1100,
  rounds: [
    {
      key: 'r1',
      title: 'How wide the clock column is, and what it says',
      note: 'B won. The :00 never carried a fact, because every label sits on an hour, so dropping it costs the reader nothing and gives the day 1.6rem of every screen back. C went one character further and lost both edges of the column: the morning is one digit and the afternoon two, and at 2.6rem the two-digit hours overhang their box by 2px. D tested the other direction and showed the axis does not want to be read first - a 1.3rem clock in --k-ink-2 is the largest text outside the title bar, over a field every call since 5 has kept quiet.',
    },
  ],
  options: [
    {
      key: 'a',
      round: 'r1',
      name: 'A · 5rem, the full clock',
      claim:
        'What the app draws today. A 5rem gutter, and 08:00 in mono at 1.05rem in --k-ink-3. The label is a time of day, written the way a time of day is written.',
      cost: 'Three of the five characters never change, because every label sits on an hour. The day pays 5rem of every screen for them.',
      verdict: 'rejected',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      round: 'r1',
      name: 'B · 3.4rem, the hour alone',
      claim:
        'The :00 goes, because no label ever carries anything else. Two digits, still right-aligned, still 1.05rem in --k-ink-3, and the gutter narrows to what they need. The day gets 1.6rem back.',
      cost: 'A column of bare two-digit numbers can read as a count before it reads as a clock. The reader learns it once, from the first label they check against a band.',
      verdict: 'chosen',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      round: 'r1',
      name: 'C · 2.6rem, no leading zero',
      claim:
        'B, and the morning hours drop their zero: 8, 9, 10. Right-aligned, so the units digit still lines up. It is the narrowest honest clock, and the gutter costs half of what it costs today.',
      cost: 'The morning is one character and the afternoon is two, so the column no longer reads as a block. It is also the smallest thing on screen to find at arm‘s length.',
      verdict: 'rejected',
      load: () => import('./option-c'),
    },
    {
      key: 'd',
      round: 'r1',
      name: 'D · 6.4rem, a clock worth reading',
      claim:
        'The other direction. The gutter widens and the label goes to 1.3rem in --k-ink-2. The axis is what every band is measured against, so the scale is set to be read, not to be small.',
      cost: 'It takes 1.4rem more from the day than today, and it makes the quietest part of the frame the largest text outside the title bar.',
      verdict: 'rejected',
      load: () => import('./option-d'),
    },
  ],
});
