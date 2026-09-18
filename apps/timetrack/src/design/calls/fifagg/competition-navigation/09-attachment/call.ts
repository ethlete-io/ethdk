import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'competition navigation',
  eyebrow: 'Fifagg · call 9',
  headline: 'How does the competition sub-navigation attach to the floating global header?',
  intro:
    'Call 8 settled the direction: the destination strip leaves the page and becomes a row attached to the global header, which itself stays the source implementation. Every option here holds the same row contents at the same geometry, so only the attachment differs.',
  frameWidth: 1400,
  options: [
    {
      key: 'a',
      name: 'A · Second row in the card',
      claim: 'The floating bar grows into a two-row card, so the header and the competition read as one object.',
      cost: 'The global header changes shape inside a competition, and the card gets tall.',
      verdict: 'chosen',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      name: 'B · Attached pill below',
      claim: 'A separate rounded bar sits under the header, themed by the competition, so the mode change is explicit.',
      cost: 'Two floating objects stack, and the gap between them costs vertical space.',
      verdict: 'rejected',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      name: 'C · Full-width band',
      claim: 'The row spans the whole viewport under the floating header, so it reads as the page owning the bar.',
      cost: 'The band belongs to the page, not to the header, so it is the weakest link to the global chrome.',
      verdict: 'rejected',
      load: () => import('./option-c'),
    },
  ],
});
