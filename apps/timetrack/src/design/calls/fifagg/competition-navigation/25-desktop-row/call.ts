import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'competition navigation',
  eyebrow: 'Fifagg · call 25',
  headline: 'What does the desktop row do with the width the phone does not have?',
  intro:
    'The phone row is settled: a chip that names the nearest stage, a square that opens the panel, both on the header gutter. At 1400px the same row leaves about 1100px of nothing between them. Calls 13 and 15 answered this before the phone dropped the page strip, so the answer is open again.',
  frameWidth: 1400,
  options: [
    {
      key: 'a',
      name: 'A · The phone row, stretched',
      claim:
        'Nothing is added. One row is designed once and holds at every width, and the empty middle is the header card breathing.',
      cost: 'A wide gap between two small objects reads as a row that lost its contents.',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      name: 'B · The pages come back between them',
      claim:
        'Desktop has room for what the phone could not hold: the competition pages sit inline, so the most-used destinations cost no click at all.',
      cost: 'The panel then duplicates the strip, and the row becomes two navigations that must agree on what is current.',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      name: 'C · The control wears its name',
      claim:
        'The square grows into a labelled button, so desktop states what the icon means and gives the pointer a target worth hovering.',
      cost: 'The phone and the desktop then run two shapes for one control, and the gap in the middle is still empty.',
      load: () => import('./option-c'),
    },
  ],
});
