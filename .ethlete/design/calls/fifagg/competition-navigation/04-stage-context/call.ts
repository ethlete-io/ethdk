import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Fifagg · call 4',
  headline: 'Are stages a different kind of navigation?',
  intro:
    'Static pages and dynamic stages no longer compete in a single strip. Both answers keep the page navigation visible; they test whether a stage is selected as the context for competition content rather than treated as another peer tab.',
  frameWidth: 1100,
  rounds: [
    {
      key: 'r1',
      title: 'Stage as context',
      note: 'Rejected: treating stages as a separate navigation pattern still preserves the faulty premise that the current inventory needs a new container.',
    },
  ],
  options: [
    {
      key: 'a',
      round: 'r1',
      name: 'A · Stage pager',
      claim:
        'A dedicated stage context bar uses previous and next controls; desktop also exposes every stage in its own row.',
      cost: 'Mobile prioritizes movement through the route over seeing every stage name at once.',
      verdict: 'rejected',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      round: 'r1',
      name: 'B · Stage cards',
      claim: 'The current stage is a strong context card and adjacent stages remain visible as compact route cards.',
      cost: 'It makes route selection more editorial and consumes more vertical room than a pager.',
      verdict: 'rejected',
      load: () => import('./option-b'),
    },
  ],
});
