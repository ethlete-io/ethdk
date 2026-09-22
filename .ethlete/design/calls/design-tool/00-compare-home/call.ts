import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Design tool · call 1',
  headline: 'Where does a comparison live?',
  intro:
    'A comparison needs to stay available while the reviewer moves through calls and rounds. Each answer draws the same chosen work, with only the place and weight of comparison changing.',
  frameWidth: 1100,
  rounds: [{ key: 'r1', title: 'The comparison home', note: '' }],
  options: [
    {
      key: 'a',
      round: 'r1',
      name: 'A · Docked workbench',
      claim:
        'Comparison is a persistent right-hand workbench. The reviewer can collect options, move between calls, and return to the same comparison without losing their place.',
      cost: 'The reading canvas is narrower whenever the workbench is open, and the tool needs real client-side state.',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      verdict: 'chosen',
      round: 'r1',
      name: 'B · Top overlay',
      claim:
        'Comparison temporarily takes over the top of the current page, keeping the original call visible directly below it.',
      cost: 'The comparison competes with the page for vertical space and still feels like an interruption rather than a place to review.',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      round: 'r1',
      name: 'C · Dedicated compare page',
      claim: 'Comparison gets an uncluttered full page, optimized for inspecting a pair at their real size.',
      cost: 'Reviewing requires a context switch, and returning to the exact round and scroll position becomes a navigation problem.',
      load: () => import('./option-c'),
    },
  ],
});
