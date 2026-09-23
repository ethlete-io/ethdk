import { defineCall } from '@design-explore';
export default defineCall({
  eyebrow: 'Design tool · call 5',
  headline: 'What is one item in the decision queue?',
  intro:
    'The queue should bring the reviewer the right unit of work—enough context to decide, but not a transcript they must read.',
  frameWidth: 1100,
  rounds: [
    {
      key: 'r1',
      title: 'The queue item',
      note: 'A queue item is one human decision: its question, candidates, comparison, and outcome. Agent runs and changes are evidence within that card, never a separate stream to work through.',
    },
  ],
  variants: [
    {
      key: 'a',
      round: 'r1',
      name: 'A · Decision card',
      claim: 'One queue item is a question with its candidate answers, comparison, and a single decision action.',
      cost: 'Agent activity is deliberately compressed into supporting evidence.',
      verdict: 'chosen',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      round: 'r1',
      name: 'B · Agent run',
      claim: 'Each tool or agent run is a first-class queue item the reviewer can inspect and advance.',
      cost: 'One human decision becomes many operational items and the queue becomes noisy.',
      verdict: 'rejected',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      round: 'r1',
      name: 'C · Change set',
      claim: 'The queue is made of proposed file changes, with a diff as its central review surface.',
      cost: 'It optimizes implementation review, not visual or product decisions.',
      verdict: 'rejected',
      load: () => import('./variant-c'),
    },
  ],
});
