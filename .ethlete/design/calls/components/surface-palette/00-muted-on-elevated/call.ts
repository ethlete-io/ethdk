import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'Surface palette',
  eyebrow: 'Storybook · surface palette · call 0',
  headline: 'Which muted colour do the two top dark elevations take?',
  intro:
    'The Storybook surfaces dark-elevated-2 (64) and dark-elevated-3 (90) keep the muted colour of dark, neutral 400 (161). That is 4.01:1 and 2.67:1, and axe fails labels in the devtools, grid and stream stories. This is the Storybook palette in apps/storybook, not SDK code. Each frame draws a label and a muted description. Dark-elevated is drawn for reference.',
  frameWidth: 720,
  rounds: [
    {
      key: 'r1',
      title: 'Muted on elevation',
      note: 'C won: dark-elevated-2 and -3 take neutral 300 as muted, one Tailwind step. A fails AA, and B adds an off-scale 180.',
    },
  ],
  variants: [
    {
      key: 'a',
      verdict: 'rejected',
      round: 'r1',
      name: 'A · Shipped neutral 400',
      claim: 'Every dark surface shares one muted colour.',
      cost: 'Under AA on dark-elevated-2 and dark-elevated-3.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'rejected',
      round: 'r1',
      name: 'B · Per elevation',
      claim: 'Dark-elevated-2 takes 180, the first grey that clears AA. Dark-elevated-3 takes neutral 300 (212).',
      cost: '180 is not a Tailwind step. Three muted greys across the dark surfaces.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      verdict: 'chosen',
      round: 'r1',
      name: 'C · Neutral 300 on both',
      claim: 'Both top elevations take neutral 300 (212), the next Tailwind step.',
      cost: 'On dark-elevated-2 the step from muted to text gets small: 7.0:1 against 9.9:1.',
      load: () => import('./variant-c'),
    },
  ],
});
