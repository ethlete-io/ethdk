import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'competition navigation',
  eyebrow: 'Fifagg · call 14',
  headline: 'How does the row mark the page you are on?',
  intro:
    'Call 13 chose the inline pages, but their underline says nothing the primary bar above says. Both controls on the right are now one size, 36px, and the live one drops its label and keeps the indicator. The tint is the gradient the source already ships: a radial from the top right at 15 percent of --et-color-primary.',
  frameWidth: 1400,
  options: [
    {
      key: 'a',
      name: 'A · Connected tab',
      claim:
        'The current page wears the shape the active zone wears in the bar above: a raised block that reaches the bottom edge, ready to flow into the menu when it opens.',
      cost: 'It is the heaviest mark, and the row can only hold one shape of this weight.',
      verdict: 'rejected',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      name: 'B · Theme pill',
      claim:
        'The current page sits in a rounded block of the competition tint, which matches the two controls on the right.',
      cost: 'It reads as a button beside two real buttons, so the row holds three things that look pressable.',
      verdict: 'chosen',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      name: 'C · Weight and a dot',
      claim:
        'No shape at all: the current page is the only one in full white, with a small dot in the competition colour.',
      cost: 'It is the quietest mark, and at a glance the row looks like plain text.',
      verdict: 'rejected',
      load: () => import('./option-c'),
    },
  ],
});
