import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'Light-surface colour themes',
  eyebrow: 'Components · on-light ink · call 1',
  headline: 'How does the filled success and warning badge reach AA?',
  intro:
    'White text on the shipped success fill (green 600) is 3.30:1 and on the warning fill (amber 600) 3.19:1, on every surface. The fill and its on-colour are shared by every filled component, for example the button, so the answer changes more than the badge. Each frame draws the four filled badges on the four Storybook surfaces with the WCAG contrast of the text. Brand and danger stay as shipped. A red number is under 4.5:1.',
  frameWidth: 720,
  rounds: [
    {
      key: 'r1',
      title: 'Filled text',
      note: 'A won: success and warning keep their 600 fills and take neutral 900 text, as brand already does, so no filled component changes its fill. B darkens every fill and sits near the 3:1 floor on dark, and C needs two rules for two themes.',
    },
  ],
  variants: [
    {
      key: 'a',
      verdict: 'chosen',
      round: 'r1',
      name: 'A · Dark text on the shipped fills',
      claim:
        'Success and warning keep their fills and take neutral 900 text: 5.44:1 and 5.63:1. Brand already uses dark text.',
      cost: 'A row mixes dark text (brand, success, warning) with white text (danger), and a dark-text green reads less like a confirmation.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'rejected',
      round: 'r1',
      name: 'B · The 700 fills with white text',
      claim: 'Success and warning move their fill to the 700 step and keep white text: 5.02:1 for both.',
      cost: 'Every filled component turns darker, and on the dark surface the 700 fills fall to 3.57:1 against the background, near the 3:1 floor for a shape.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      verdict: 'rejected',
      round: 'r1',
      name: 'C · Each theme takes its own fix',
      claim:
        'Success moves to the green 700 fill with white text (5.02:1). Warning keeps its amber fill and takes dark text (5.63:1), the usual convention for amber.',
      cost: 'Two rules for two themes, and the green fill still darkens in every filled component.',
      load: () => import('./variant-c'),
    },
  ],
});
