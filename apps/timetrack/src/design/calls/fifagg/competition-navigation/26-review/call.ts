import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'competition navigation',
  eyebrow: 'Fifagg · call 26',
  headline: 'The settled row, both widths',
  intro:
    'A review, not a question. Both drawings are copied from the calls that settled them: the phone from call 24 and the desktop from call 25. The phone leads with the live state and draws the next state, the ended state and an overflow name below it. The desktop draws the live state, a viewport too narrow for every page, and an overflow name. Nothing here is new; the point is to see whether the two widths read as one design.',
  frameWidth: 1400,
  options: [
    {
      key: 'a',
      name: 'The settled row, desktop over phone',
      load: () => import('./option-a'),
    },
  ],
});
