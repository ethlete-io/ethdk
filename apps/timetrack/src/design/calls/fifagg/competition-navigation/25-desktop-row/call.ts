import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'competition navigation',
  eyebrow: 'Fifagg · call 25',
  headline: 'The desktop row: call 16 A with the competition name removed',
  intro:
    'A reference picture, not a question. It is the call 16 A drawing with one change: the competition name and its divider are gone, so the page strip starts at the gutter the name held. Everything else is untouched - the four visible pages, the "More" button as the last entry in the strip, and the live stage on a split control at the far right. The stage reads "Group Stage", because "Group Stage · Week 4" was ruled invented.',
  frameWidth: 1400,
  options: [
    {
      key: 'a',
      name: 'The row, with the name removed',
      load: () => import('./option-a'),
    },
  ],
});
