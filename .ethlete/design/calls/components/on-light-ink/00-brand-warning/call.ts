import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'Light-surface colour themes',
  eyebrow: 'Components · on-light ink · call 0',
  headline: 'Which ink do brand-on-light and warning-on-light carry?',
  intro:
    'The Storybook light surfaces map error and success to danger-on-light (red 700 ink) and success-on-light (green 800 ink). Brand and warning have no on-light theme, so the badge and scheduler stories cannot draw a light row. Each frame draws the badge in its three variants for brand and warning on light and light-elevated, with the WCAG contrast of each. The fills and the filled text stay as shipped; only the ink changes. A red number is under 4.5:1.',
  frameWidth: 720,
  rounds: [
    {
      key: 'r1',
      title: 'Ink step',
      note: 'D won: each theme takes the lightest Tailwind step that clears AA on every badge, so brand takes emerald 700 and warning takes amber 800. A leaves warning tonal at 4.07:1, B darkens brand more than it needs, and C invents a brand shade nobody picked.',
    },
  ],
  variants: [
    {
      key: 'a',
      verdict: 'rejected',
      round: 'r1',
      name: 'A · The 700 step for both',
      claim: 'Brand takes emerald 700 and warning takes amber 700, the same step as the danger-on-light ink.',
      cost: 'Warning tonal falls to 4.07:1 on light-elevated, under AA, so the step fixes outline only.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'rejected',
      round: 'r1',
      name: 'B · The 800 step for both',
      claim:
        'Brand takes emerald 800 and warning takes amber 800, the same step as the success-on-light ink. Every badge clears 5.7:1.',
      cost: 'The darkest pair: the brand ink reads close to a neutral dark green and loses the mint of the fill.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      verdict: 'rejected',
      round: 'r1',
      name: 'C · Brand keeps its own hue',
      claim:
        'Brand takes 0 122 77, a darker step of the brand mint itself, and warning takes amber 800. Every badge clears 4.8:1.',
      cost: 'The brand ink is an app colour nobody picked, and it has the least margin on tonal: 4.82:1.',
      load: () => import('./variant-c'),
    },
    {
      key: 'd',
      verdict: 'chosen',
      round: 'r1',
      name: 'D · The smallest step that passes',
      claim:
        'Brand takes emerald 700 and warning takes amber 800: for each theme, the lightest Tailwind step that clears AA on every badge.',
      cost: 'The two themes sit on different steps, so the rule for the next on-light theme is "test it", not "take step N".',
      load: () => import('./variant-d'),
    },
  ],
});
