import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'competition navigation',
  eyebrow: 'Fifagg · call 19',
  headline: 'How does the control that opens the full map sit in the row?',
  intro:
    'Four corrections are applied first. The "Overview · 5 more pages" line is gone, because no product writes that. The stage is one name, "Group Stage", because "Group Stage · Week 4" is not a name any stage carries. The count badge is gone. The shipped Overview/Tournament tabs are gone from the drawing, because they are the navigation this redesign replaces. What is left is one line and one control, and the control looked pasted on. The intent behind it: a tap morphs the bar into a full-page panel holding everything the competition has.',
  frameWidth: 390,
  rounds: [
    {
      key: 'r1',
      title: 'One target or two',
      note: 'All three rejected. A makes the whole row one target, so the live stage cannot be reached in one tap. B and C keep the map separate but neither gives the live stage a target of its own. The next pass holds two rules at once: the live stage is a one-tap link, and the map needs no precise aim.',
    },
    { key: 'r2', title: 'Two large targets', note: '' },
  ],
  options: [
    {
      key: 'a',
      round: 'r1',
      verdict: 'rejected',
      name: 'A · The whole row is the control',
      claim:
        'There is no button. The row itself is the tap target, with the grid mark at its right edge, so the thing that morphs is the thing you press.',
      cost: 'The stage name is then not tappable on its own, so reaching the live stage costs a second tap inside the panel.',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      round: 'r1',
      verdict: 'rejected',
      name: 'B · A bare icon, like the header ones',
      claim:
        'The grid drops its chip and becomes a plain icon button, the same size and weight as the search and burger icons above it.',
      cost: 'It reads as one more header icon, so nothing says it opens the competition rather than a global menu.',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      round: 'r1',
      verdict: 'rejected',
      name: 'C · The right edge of the bar',
      claim:
        'A full-height zone at the right end of the row, divided by the same hairline that separates the two rows. It belongs to the bar instead of sitting on it.',
      cost: 'A full-height divider adds a second line to a row that has only one, and the edge is hard to reach with a thumb.',
      load: () => import('./option-c'),
    },
    {
      key: 'd',
      round: 'r2',
      name: 'D · Two zones, one seam',
      claim:
        'The row is two full-height zones divided by a hairline: the live stage takes everything to the left of it, the map a 54px zone at the right. Both targets are 48px tall.',
      cost: 'The seam is a second line in a row that has one, and the map zone sits in the far corner.',
      load: () => import('./option-d'),
    },
    {
      key: 'e',
      round: 'r2',
      name: 'E · A chip and a square',
      claim:
        'The live stage is a chip with its own bounds, the map a filled 44px square. Nothing is ambiguous: two objects, a gap between them, each one clearly a button.',
      cost: 'Two filled shapes in a row that carries one fact, so the row reads busier than it is.',
      load: () => import('./option-e'),
    },
    {
      key: 'f',
      round: 'r2',
      name: 'F · The map joins the header icons',
      claim:
        'The grid moves up beside search and burger, where a global control belongs. The whole competition row is then one thing: the link to the live stage.',
      cost: 'The map is no longer part of the bar it opens, so the morph starts from a different row.',
      load: () => import('./option-f'),
    },
  ],
});
