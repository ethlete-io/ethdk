import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'competition navigation',
  eyebrow: 'Fifagg · call 16',
  headline: 'How does the row carry a 72-character competition name?',
  intro:
    'Call 15 chose the strip without a competition button. Here the overflow menu is one more entry beside Ranking and the stage control sits at the far right, as asked. The name drawn is a real one: "Cyprus Football Association Esports Competition - Featuring Rocket League".',
  frameWidth: 1400,
  options: [
    {
      key: 'a',
      name: 'A · Use the short name',
      claim: 'The stage view already carries shortName, so the row states the short name and never truncates.',
      cost: 'The short name is editorial data, so a competition with a bad one reads worse than a cut long one.',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      name: 'B · Cap the full name',
      claim: 'The full name stays, capped at 260px with an ellipsis, and the page heading below states it whole.',
      cost: 'The cut falls in the middle, and two competitions of one series can read the same in the row.',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      name: 'C · The name is the first entry',
      claim:
        'The name stops being a label: it is the first item of the strip and links to the overview, so it costs one slot.',
      cost: 'It is capped as well, and the competition loses the standing heading the other two keep.',
      load: () => import('./option-c'),
    },
  ],
});
