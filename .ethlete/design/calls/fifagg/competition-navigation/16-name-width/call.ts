import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'competition navigation',
  eyebrow: 'Fifagg · call 16',
  headline: 'How does the row carry a 72-character competition name?',
  intro:
    'Call 15 chose the strip without a competition button. Here the overflow menu is one more entry beside Ranking and the stage control sits at the far right, as asked. The name drawn is a real one: "Cyprus Football Association Esports Competition - Featuring Rocket League".',
  frameWidth: 1400,
  rounds: [
    {
      key: 'r1',
      title: 'Shorten the name',
      note: 'All three rejected. A rests on a field that does not exist: a stage may carry a shortName, the competition never does. B and C are the same answer, an ellipsis, and C pays a strip slot for it. The exploration then moved to the phone, where the width is the real constraint: call 17.',
    },
  ],
  options: [
    {
      key: 'a',
      round: 'r1',
      name: 'A · Use the short name',
      claim: 'The stage view already carries shortName, so the row states the short name and never truncates.',
      cost: 'The competition carries no shortName of its own, so the field the option needs does not exist.',
      verdict: 'rejected',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      round: 'r1',
      name: 'B · Cap the full name',
      claim: 'The full name stays, capped at 260px with an ellipsis, and the page heading below states it whole.',
      cost: 'The cut falls in the middle, and two competitions of one series can read the same in the row.',
      verdict: 'rejected',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      round: 'r1',
      name: 'C · The name is the first entry',
      claim:
        'The name stops being a label: it is the first item of the strip and links to the overview, so it costs one slot.',
      cost: 'It is B with an extra step: still an ellipsis, and now it spends a strip slot as well.',
      verdict: 'rejected',
      load: () => import('./option-c'),
    },
  ],
});
