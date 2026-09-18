import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'competition navigation',
  eyebrow: 'Fifagg · call 22',
  headline: 'What does the chip carry when no stage is live?',
  intro:
    'Live is one state of five. A competition waits before it starts, waits between two stages, ends, and spends its first days announced with no stage at all. The square never changes, so the chip is the whole question. Each option draws one rule: the big frame is the state before the competition starts, and the four strips below are the same rule in the other states.',
  frameWidth: 390,
  options: [
    {
      key: 'a',
      name: 'A · The nearest stage, whichever way it lies',
      claim:
        'The chip always names a stage and says what it does: the next one starts, the last one ended. It stays a one-tap link to the stage that matters now.',
      cost: 'The chip points forward in one state and backward in another, and it is gone entirely while no stage exists.',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      name: 'B · The chip is only ever a live stage',
      claim:
        'No live stage, no chip. The row keeps the square and a plain label, and every schedule lives inside the panel the square opens.',
      cost: 'The row then carries no news for most of a competition, and four of five states look the same.',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      name: 'C · The chip states the competition',
      claim:
        'The chip reports the competition itself: starts, between stages, ended, announced. One sentence covers every state, including the one with no stage.',
      cost: 'The same shape is a link while live and a label in four other states, so what a tap does changes under you.',
      load: () => import('./option-c'),
    },
  ],
});
