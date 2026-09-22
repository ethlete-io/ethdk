import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'competition navigation',
  eyebrow: 'Fifagg · call 15',
  headline: 'What does each control on the right actually do?',
  intro:
    'The live control carries a chevron but the competition button is what opens the menu, so the row states two jobs and explains neither. Every option here holds all eight pages of the competition, four of them in the strip.',
  frameWidth: 1400,
  options: [
    {
      key: 'a',
      name: 'A · Live is a link',
      claim: 'The live control loses its chevron and becomes what it looks like: a link to the stage that matters now.',
      cost: 'The stage list is then only reachable through the competition menu.',
      verdict: 'rejected',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      name: 'B · Live is a split button',
      claim:
        'The label goes to the live stage and the chevron half opens the four stages, so the chevron earns its place.',
      cost: 'A split control is two targets in one shape, which is the hardest of the three to hit on a phone.',
      verdict: 'rejected',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      name: 'C · No competition button',
      claim:
        'Every page sits in the strip, an overflow menu takes the last ones that do not fit, and the split control owns the stages.',
      cost: 'Nothing opens a mega panel any more, so this reopens call 11.',
      verdict: 'chosen',
      load: () => import('./option-c'),
    },
  ],
});
