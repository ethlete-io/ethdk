import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'competition navigation',
  eyebrow: 'Fifagg · call 19',
  headline: 'How does the control that opens the full map sit in the row?',
  intro:
    'Four corrections are applied first. The "Overview · 5 more pages" line is gone, because no product writes that. The stage is one name, "Group Stage", because "Group Stage · Week 4" is not a name any stage carries. The count badge is gone. The shipped Overview/Tournament tabs are gone from the drawing, because they are the navigation this redesign replaces. What is left is one line and one control, and the control looked pasted on. The intent behind it: a tap morphs the bar into a full-page panel holding everything the competition has.',
  frameWidth: 390,
  options: [
    {
      key: 'a',
      name: 'A · The whole row is the control',
      claim:
        'There is no button. The row itself is the tap target, with the grid mark at its right edge, so the thing that morphs is the thing you press.',
      cost: 'The stage name is then not tappable on its own, so reaching the live stage costs a second tap inside the panel.',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      name: 'B · A bare icon, like the header ones',
      claim:
        'The grid drops its chip and becomes a plain icon button, the same size and weight as the search and burger icons above it.',
      cost: 'It reads as one more header icon, so nothing says it opens the competition rather than a global menu.',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      name: 'C · The right edge of the bar',
      claim:
        'A full-height zone at the right end of the row, divided by the same hairline that separates the two rows. It belongs to the bar instead of sitting on it.',
      cost: 'A full-height divider adds a second line to a row that has only one, and the edge is hard to reach with a thumb.',
      load: () => import('./option-c'),
    },
  ],
});
