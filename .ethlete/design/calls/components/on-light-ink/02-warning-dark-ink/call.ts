import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'Light-surface colour themes',
  eyebrow: 'Components · on-light ink · call 2',
  headline: 'Which ink does the warning theme carry on dark?',
  intro:
    'The warning theme has no ink, so on dark its text falls back to the amber 600 fill: 3.81:1 on a tonal badge and 3.93:1 on a scheduler chip on dark-elevated. Danger and success use the 400 step as their dark ink. Each frame draws a tonal badge, an outline badge, a scheduler chip and plain text on dark and dark-elevated. A red number is under 4.5:1.',
  frameWidth: 720,
  rounds: [
    {
      key: 'r1',
      title: 'Dark ink',
      note: 'B won: amber 500 is the lightest step that clears AA everywhere, the same rule as the on-light inks. A fails AA, C reads as bright as the brand mint, and D splits the badge into two hues.',
    },
  ],
  variants: [
    {
      key: 'a',
      verdict: 'rejected',
      round: 'r1',
      name: 'A · Shipped',
      claim: 'No ink: the text takes the amber 600 fill.',
      cost: 'Under AA on the tonal badge and the chip on dark-elevated.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'chosen',
      round: 'r1',
      name: 'B · Amber 500',
      claim:
        'The lightest amber step that clears AA everywhere: 5.65:1 at the least. The same rule as brand-on-light and warning-on-light.',
      cost: 'One step off the 400 that danger and success use on dark.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      verdict: 'rejected',
      round: 'r1',
      name: 'C · Amber 400',
      claim: 'The 400 step, like danger and success on dark: 7.27:1 at the least.',
      cost: 'A yellower amber that sits close to the brand mint in brightness, so warning and brand text read alike at a glance.',
      load: () => import('./variant-c'),
    },
    {
      key: 'd',
      verdict: 'rejected',
      round: 'r1',
      name: 'D · Orange 400',
      claim: 'The ink leans to orange: 5.36:1 at the least, and further from the yellow-green of brand.',
      cost: 'The ink and the amber fill are two hues, so a tonal badge reads as two colours.',
      load: () => import('./variant-d'),
    },
  ],
});
