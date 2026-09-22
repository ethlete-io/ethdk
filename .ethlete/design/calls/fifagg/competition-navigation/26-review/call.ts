import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'competition navigation',
  eyebrow: 'Fifagg · call 26',
  headline: 'The settled row, both widths',
  intro:
    'A review, not a question. Both drawings are copied from the calls that settled them: the phone from call 24 and the desktop from call 25. The phone leads with the live state and draws the next state, the ended state and an overflow name below it. The desktop draws the live state, a viewport too narrow for every page, and an overflow name. Nothing here is new; the point is to see whether the two widths read as one design.',
  frameWidth: 1400,
  rounds: [
    {
      key: 'r1',
      title: 'variants',
      note: '',
    },
  ],
  options: [
    {
      key: 'a',
      name: 'The settled row, desktop over phone',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      round: 'r1',
      name: 'The settled control, moved behind Overview',
      claim:
        'The stage keeps the shape both widths already ship, and only its slot changes. It now leads the row, as it does on the phone, and a hairline rule hands the row over to the pages.',
      cost: 'A bordered control inside the link row breaks the rhythm of the links, and the right end of the bar stands empty.',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      round: 'r1',
      name: 'The stage as the entry after Overview',
      claim:
        'The stage is one more entry in the link row, at the same height and the same padding. The row reads as one line: Overview, then the stage that is live, then its pages.',
      cost: 'With no border and no fill, the stage no longer reads as a control that opens a picker. Only the chevron says so.',
      load: () => import('./option-c'),
    },
    {
      key: 'd',
      round: 'r1',
      name: 'Overview and the stage as one unit',
      claim:
        'One segmented control heads the row and states where you are: the competition root, then the stage in view, then the chevron that opens the others.',
      cost: 'Overview leaves the link row, so the first page is styled unlike the seven after it, and the unit takes width before a single page is read.',
      load: () => import('./option-d'),
    },
  ],
});
