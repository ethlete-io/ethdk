import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'Surface palette',
  eyebrow: 'Storybook · surface palette · call 1',
  headline: 'Is the light muted colour dark enough to sit on a tint?',
  intro:
    'The Storybook light surfaces use neutral 500 (115) as the muted colour: 4.74:1 on white, 4.54:1 on light-elevated. Any tint under it drops it below AA. The kbd key (an 8% tint) is 4.31:1 and the banner description (an 8% theme tint) is 4.2-4.4:1, and axe fails both on light. The placeholder and outside dates take muted too, if those calls go to muted. Each frame draws a hint, a kbd key and three banners.',
  frameWidth: 720,
  rounds: [
    {
      key: 'r1',
      title: 'Muted on light',
      note: 'B won: light muted becomes neutral 600, so muted text clears AA on every tint. A fails on kbd keys and banners, and C needs a rule in each component on a tint.',
    },
  ],
  variants: [
    {
      key: 'a',
      verdict: 'rejected',
      round: 'r1',
      name: 'A · Shipped neutral 500',
      claim: 'Light muted stays 115.',
      cost: 'Kbd keys and banner descriptions fail AA on both light surfaces.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'chosen',
      round: 'r1',
      name: 'B · Neutral 600',
      claim: 'Light muted becomes neutral 600 (82). It clears AA on every tint, and so does all muted text on light.',
      cost: 'The step from muted to text gets smaller: 7.8:1 against 17.9:1 on white.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      verdict: 'rejected',
      round: 'r1',
      name: 'C · Text colour inside a tint',
      claim: 'Muted stays 115. The kbd key and the banner description take the full text colour.',
      cost: 'Two components change, and any next component on a tint needs the same rule.',
      load: () => import('./variant-c'),
    },
  ],
});
