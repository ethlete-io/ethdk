import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Fifagg · call 2',
  headline: 'How does the complete structure stay visible?',
  intro:
    'Every answer keeps the same pages and four stages in the ordinary page flow. The desktop frame has room; the mobile frame tests the same information model without an overlay or a viewport-fixed control.',
  frameWidth: 1100,
  rounds: [
    {
      key: 'r1',
      title: 'The visible structure',
      note: 'Rejected: the structure must stay visible, but it cannot consume a mobile screen before content begins. A timeline also makes an uncertain navigation metaphor.',
    },
  ],
  options: [
    {
      key: 'a',
      round: 'r1',
      name: 'A · Wrapped route map',
      claim: 'Pages occupy a compact first row and every stage occupies a second, wrapping route row under the hero.',
      cost: 'A long competition moves the content lower, and the flat row gives every stage nearly equal visual weight.',
      verdict: 'rejected',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      round: 'r1',
      name: 'B · Competition timeline',
      claim:
        'A dedicated, always-expanded route map makes chronology and the current stage visible alongside the static pages.',
      cost: 'It is a substantial module above the content, so short competitions may feel over-explained.',
      verdict: 'rejected',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      round: 'r1',
      name: 'C · Persistent outline',
      claim:
        'The competition map becomes the page outline: a desktop rail and the same expanded outline below the mobile hero.',
      cost: 'The desktop layout gives up reading width and the map becomes a heavier commitment on every competition page.',
      verdict: 'rejected',
      load: () => import('./option-c'),
    },
  ],
});
