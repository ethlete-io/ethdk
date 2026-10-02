import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'Forms contrast',
  eyebrow: 'Components · forms · call 1',
  headline: 'Which colour do form errors, warnings and the over-limit counter take?',
  intro:
    'The form field error and warning messages, the form support messages and the over-limit counter draw in --et-theme-color-primary-solid: the fill of the theme. Danger on dark is 3.71:1, warning on white 3.18:1, and axe fails both. Theme-coloured text elsewhere takes the theme ink. The light frames assume the Storybook light surfaces also map warning to warning-on-light; today they map only error and success.',
  frameWidth: 720,
  rounds: [
    {
      key: 'r1',
      title: 'Message colour',
      note: 'B won: messages and the counter take the theme ink, as other theme text does. A fails AA for danger on dark and for warning.',
    },
  ],
  variants: [
    {
      key: 'a',
      verdict: 'rejected',
      round: 'r1',
      name: 'A · Shipped primary',
      claim: 'Messages and the counter take the fill colour of the theme.',
      cost: 'Under AA for danger on dark and for warning on light and dark.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'chosen',
      round: 'r1',
      name: 'B · Ink',
      claim: 'Messages and the counter take --et-theme-color-ink-solid, as other theme text does.',
      cost: 'The red reads softer on dark. On dark-elevated-2 the danger ink still fails, 3.75:1, as muted does there.',
      load: () => import('./variant-b'),
    },
  ],
});
