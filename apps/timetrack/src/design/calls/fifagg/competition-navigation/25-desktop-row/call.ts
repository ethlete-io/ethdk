import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'competition navigation',
  eyebrow: 'Fifagg · call 25',
  headline: 'How does the chevron sit against the live stage control?',
  intro:
    'The row is call 16 A with the competition name removed: the page strip at the gutter, every page fitting at 1400px, no overflow menu and no count on anything. The control now carries the subline the phone settled, so it is two lines tall when the stage name is short, and one line when it is not. That makes the chevron beside it a column of empty height. The second row in each frame is the long-name case.',
  frameWidth: 1400,
  options: [
    {
      key: 'a',
      name: 'A · The seam runs the full height',
      claim:
        'One object, cut in two: the seam meets the border top and bottom, so the two halves read as one control with two jobs.',
      cost: 'The seam is a second vertical line beside the control border, and the chevron floats in a tall empty column.',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      name: 'B · The seam is inset',
      claim:
        'The seam shrinks to 22px and centres, so it separates the two jobs without cutting the shape, and the chevron sits on its own centre line.',
      cost: 'A short seam inside a tall control is a third alignment to get right, and it weakens the split it marks.',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      name: 'C · The chevron is its own square',
      claim:
        'No seam at all. The chevron becomes a bounded square beside the control with a gap, which is exactly the pair the phone settled.',
      cost: 'Two bordered shapes sit at the right end, and the link between the stage and its stage list is only proximity.',
      load: () => import('./option-c'),
    },
  ],
});
