import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'competition navigation',
  eyebrow: 'Fifagg · call 25',
  headline: 'Where do the settled chip and square sit in the desktop row?',
  intro:
    'The desktop row is call 16 A with the competition name removed: the pages inline, the controls at the right end. That much is settled and is not open here. What is open is the pair the phone settled after it: the chip that names the nearest stage, and the square that opens the panel. Call 16 still drew the old split control and overflow button in their place.',
  frameWidth: 1400,
  rounds: [
    {
      key: 'r1',
      title: 'What the width is for',
      note: 'All three rejected. The round re-asked what call 13 settled: whether the pages belong in the row at all. They do, and the desktop row starts from call 16 A with the name dropped, not from the phone row stretched.',
    },
  ],
  options: [
    {
      key: 'a',
      round: 'r1',
      verdict: 'rejected',
      name: 'A · The phone row, stretched',
      claim:
        'Nothing is added. One row is designed once and holds at every width, and the empty middle is the header card breathing.',
      cost: 'A wide gap between two small objects reads as a row that lost its contents.',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      round: 'r1',
      verdict: 'rejected',
      name: 'B · The pages come back between them',
      claim:
        'Desktop has room for what the phone could not hold: the competition pages sit inline, so the most-used destinations cost no click at all.',
      cost: 'The panel then duplicates the strip, and the row becomes two navigations that must agree on what is current.',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      round: 'r1',
      verdict: 'rejected',
      name: 'C · The control wears its name',
      claim:
        'The square grows into a labelled button, so desktop states what the icon means and gives the pointer a target worth hovering.',
      cost: 'The phone and the desktop then run two shapes for one control, and the gap in the middle is still empty.',
      load: () => import('./option-c'),
    },
    {
      key: 'd',
      round: 'r2',
      name: 'D · The strip takes the left, the pair the right',
      claim:
        'The pages move into the gutter the name left, and the chip and the square sit together at the right end, which is where call 13 put the status.',
      cost: 'The row then leads with the pages, so the live stage is the last thing read on the widest screen.',
      load: () => import('./option-d'),
    },
    {
      key: 'e',
      round: 'r2',
      name: 'E · The chip leads, the strip follows',
      claim:
        'The phone order holds: the chip at the gutter, the pages beside it, the square at the far right. One reading rule at both widths.',
      cost: 'The chip and the square are then split across the whole row, so the pair the phone settled no longer reads as a pair.',
      load: () => import('./option-e'),
    },
    {
      key: 'f',
      round: 'r2',
      name: 'F · The live stage is the first entry',
      claim:
        'The stage is a destination like the pages, so it leads the strip as a themed entry, and only the square stays on the right.',
      cost: 'A link inside the strip looks like a page of the competition, and the strip then holds two kinds of thing.',
      load: () => import('./option-f'),
    },
  ],
});
