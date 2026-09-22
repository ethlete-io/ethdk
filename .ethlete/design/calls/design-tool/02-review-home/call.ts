import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Design tool · call 3',
  headline: 'What is the tool’s primary review surface?',
  intro:
    'The new tool should make a decision quickly, preserve its history, and avoid making the reviewer hunt through a long document. Each answer reorganizes the same work around a different primary action.',
  frameWidth: 1100,
  rounds: [
    {
      key: 'r1',
      title: 'The review home',
      note: 'The tool opens on one active decision. Queue navigation and a central comparison minimize clicking and scrolling; the atlas and journal remain supporting views.',
    },
  ],
  options: [
    {
      key: 'a',
      round: 'r1',
      name: 'A · Decision queue',
      claim:
        'One decision fills the workspace. Next/previous moves through a queue, comparison is central, and the result is recorded beside it.',
      cost: 'It deliberately hides unrelated options until the reviewer asks for them.',
      verdict: 'chosen',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      round: 'r1',
      name: 'B · Visual atlas',
      claim:
        'The tool opens as a compact wall of every option, built for scanning before deciding what deserves attention.',
      cost: 'Every decision begins by finding the relevant card, and the chosen comparison has less room.',
      verdict: 'rejected',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      round: 'r1',
      name: 'C · Decision journal',
      claim: 'The primary surface is an ordered account of rounds, decisions, and the alternatives they ruled out.',
      cost: 'It is excellent for explanation but turns active review back into scrolling through history.',
      verdict: 'rejected',
      load: () => import('./option-c'),
    },
  ],
});
