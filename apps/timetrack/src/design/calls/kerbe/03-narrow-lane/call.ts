import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Kerbe · call 3',
  headline: 'A lane too narrow for both',
  intro:
    'The break lane is 6rem wide, so "Break" and "45m" cannot share a row. Every frame below is that lane, with the three break lengths a day produces and one work band for the general case. The 15m band has no duration at any width, so all three draw it the same.',
  frameWidth: 120,
  result:
    'A wins, decided 2026-09-17. Under 10rem the band hides its duration and keeps the label on one row. The rule holds for any lane that gets narrow, not only the break lane.',
  options: [
    {
      key: 'a',
      name: 'A · The duration goes',
      claim: 'Under 10rem the band hides its duration and keeps the label on one row.',
      cost: 'In the break lane the label repeats the lane header, so the row says nothing new.',
      verdict: 'chosen',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      name: 'B · The duration moves under',
      claim: 'The head turns into two rows. A 15m band has room for one, so it falls back to A.',
      cost: 'Two rows in a 30m band leave no ground, and the type sits tighter than anywhere else.',
      verdict: 'rejected',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      name: 'C · The label goes',
      claim: 'The duration takes the row. The lane header already carries the name.',
      cost: 'A work lane that falls to 10rem would lose its ticket, which is the thing the reader needs.',
      verdict: 'rejected',
      load: () => import('./option-c'),
    },
  ],
});
