import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'competition navigation',
  eyebrow: 'Fifagg · call 20',
  headline: 'What does the chip do with a stage name it cannot fit?',
  intro:
    'Call 19 chose the chip and the square. A stage name is free text, so the row has to survive one it cannot fit: "Play-In Qualifier Round 2 · Europe & Africa". The square never moves, so the chip is the only thing that can give way.',
  frameWidth: 390,
  options: [
    {
      key: 'a',
      name: 'A · The name truncates in the chip',
      claim: 'The chip takes the width that is left and cuts the name, so the row keeps one height and one shape.',
      cost: 'The cut lands mid-name, and "is live now" holds width the name needs.',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      name: 'B · Drop "is live now" first',
      claim:
        'The dot already says the stage is live, so the verb goes before the name does. The name gets the whole chip and is cut only after that.',
      cost: 'The row then reads two ways: with the verb on a short name, without it on a long one.',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      name: 'C · The chip wraps',
      claim: 'The chip wraps to a second line and keeps the whole name, so nothing about the stage is ever hidden.',
      cost: 'The row height then depends on the stage name, and the square no longer centres against one line.',
      load: () => import('./option-c'),
    },
  ],
});
