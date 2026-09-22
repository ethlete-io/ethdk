import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Fifagg · call 3',
  headline: 'How does the index adapt in page flow?',
  intro:
    'The desktop frame leaves every destination exposed. The mobile frame uses a compact in-flow disclosure: it does not cover the page, duplicate the existing competition timeline, or attach itself to the browser edge.',
  frameWidth: 1100,
  rounds: [
    {
      key: 'r1',
      title: 'The responsive index',
      note: 'Rejected: a stacked inventory is not a useful navigation shape. It inherits the same scanning and height cost as a full mobile menu without solving either.',
    },
  ],
  options: [
    {
      key: 'a',
      round: 'r1',
      name: 'A · Competition index card',
      claim:
        'One compact card groups pages and stages. Desktop leaves it open; mobile uses the same card as an in-flow expandable index.',
      cost: 'The card is a distinct block between hero and content, so it must stay denser than the page it serves.',
      verdict: 'rejected',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      round: 'r1',
      name: 'B · Pages plus stage disclosure',
      claim:
        'Static pages stay as ordinary links while only the dynamic, potentially long stage list collapses in page flow on mobile.',
      cost: 'The two kinds of destination receive different containers, which can make the overall map feel less unified.',
      verdict: 'rejected',
      load: () => import('./option-b'),
    },
  ],
});
