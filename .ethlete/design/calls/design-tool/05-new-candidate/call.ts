import { defineCall } from '@design-explore';
export default defineCall({
  eyebrow: 'Design tool · call 6',
  headline: 'How does a new candidate re-open a decision?',
  intro:
    'New work should surface the delta and preserve the result already earned, instead of recreating a long round history.',
  frameWidth: 1100,
  rounds: [
    {
      key: 'r1',
      title: 'New candidate review',
      note: 'A settled decision remains the baseline. A new candidate arrives as one challenger to the winner, while previous rounds remain folded evidence instead of forcing a replay.',
    },
  ],
  variants: [
    {
      key: 'a',
      round: 'r1',
      name: 'A · Challenger card',
      claim: 'The winner remains the baseline and the new candidate arrives as one focused challenger card.',
      cost: 'Comparing two old rejected alternatives requires opening the decision history.',
      verdict: 'chosen',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      round: 'r1',
      name: 'B · New round section',
      claim: 'Every addition appends a named round below the earlier options.',
      cost: 'The reviewer has to scroll, reconstruct context, and review old work again.',
      verdict: 'rejected',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      round: 'r1',
      name: 'C · Full decision reset',
      claim: 'A new candidate restores every prior option to the active comparison.',
      cost: 'The decision loses its settled shape and the candidate set quickly becomes unwieldy.',
      verdict: 'rejected',
      load: () => import('./variant-c'),
    },
  ],
});
