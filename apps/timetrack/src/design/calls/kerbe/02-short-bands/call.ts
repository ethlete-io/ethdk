import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Kerbe · call 2',
  headline: 'What a 15m band gives up',
  intro:
    'A band is as tall as the time it covers, at 8rem to the hour, and the app books in 15m increments. So 15m is 2rem, a padded row needs 3.2rem, and 15m is the only length that cannot hold one - 30m gets 4rem and holds one with room to spare. Every frame below draws the four real lengths, shortest first.',
  frameWidth: 300,
  options: [
    {
      key: 'a',
      name: 'A · Smaller type',
      claim: 'What the sketch did: the 15m band drops its padding and its duration, and its label goes to 1.15rem.',
      cost: 'The label changes size down a column, so a 15m band reads as a lesser kind of band.',
      verdict: 'rejected',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      name: 'B · Same type, centred',
      claim:
        'The 15m band drops its block padding and its duration. Its label stays at 1.3rem and sits centred in the 2rem.',
      cost: 'A 15m band is the one band with no duration on it.',
      verdict: 'chosen',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      name: 'C · Same type, keep the duration',
      claim: 'As B, and the duration stays on the label row. Both do fit on one row in 2rem.',
      cost: 'The grid already says the band is 15m, so the number repeats what the reader can see.',
      verdict: 'rejected',
      load: () => import('./option-c'),
    },
  ],
});
