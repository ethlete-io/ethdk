import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Fifagg · call 7',
  headline: 'Where does the current competition belong in the real header hierarchy?',
  intro:
    'Both answers use the existing FIFAe header, its expandable rich-navigation panel and its mobile slide transition. Both replace the overflowing competition tab strip with the same local map; only the route into that map changes.',
  frameWidth: 1100,
  rounds: [
    {
      key: 'r1',
      title: 'Local map inside the global header',
      note: 'Rejected as drawn: the temporary zone can be overlooked, while the Esports drill-in hides the same destination another level deeper. The route-specific header premise survives, but it needs to become an unmistakable competition mode.',
    },
  ],
  options: [
    {
      key: 'a',
      round: 'r1',
      name: 'A · Temporary competition zone',
      claim:
        'While a competition is in context, it becomes a temporary sibling of Gaming and Esports and opens its local map in one step.',
      cost: 'A route-specific destination enters a header whose other zones are stable global categories.',
      verdict: 'rejected',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      round: 'r1',
      name: 'B · Esports drill-in',
      claim:
        'The global header stays unchanged; the current competition is one level deeper inside Esports and reuses the existing back transition.',
      cost: 'The local map takes an extra step to reach, and its parent relationship to eFootball must remain clear.',
      verdict: 'rejected',
      load: () => import('./option-b'),
    },
  ],
});
