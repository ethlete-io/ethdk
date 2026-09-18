import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'competition navigation',
  eyebrow: 'Fifagg · call 23',
  headline: 'What does the chip read when the stage has no date it can show?',
  intro:
    'Call 22 put the nearest stage in the chip, with a time behind the name. The time is the part the data cannot promise: `scheduledAt` is nullable, and a stage that holds one may hold a value the row must not print. So the chip needs a reading with no time in it. The big frame is the null case, and the strips below are a sound date, a value the row cannot show, and a stage that ended.',
  frameWidth: 390,
  options: [
    {
      key: 'a',
      verdict: 'chosen',
      name: 'A · Keep the verb, drop the time',
      claim:
        'The name keeps a word that places it in time: "Group Stage next", "Final ended". The word never depends on a date, so every state reads the same way.',
      cost: '"next" is a weaker promise than a time, and it looks like a time that failed to load.',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      verdict: 'rejected',
      name: 'B · The name alone',
      claim:
        'With no date, the chip is the stage name and the ring. Nothing is written that the data did not give, and the chip is at its shortest exactly when a name is longest.',
      cost: 'A bare name says the stage matters but not why, so the row loses its one piece of news.',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      verdict: 'rejected',
      name: 'C · Say the date is missing',
      claim:
        'The chip reads "Group Stage · date to come", so a missing schedule is stated rather than hidden, and a reader stops waiting for a time that is not coming.',
      cost: 'The row then reports the state of the data, and the phrase is longer than the time it replaces.',
      load: () => import('./option-c'),
    },
  ],
});
