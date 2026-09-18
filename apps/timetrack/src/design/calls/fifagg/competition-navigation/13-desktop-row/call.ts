import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'competition navigation',
  eyebrow: 'Fifagg · call 13',
  headline: 'What does the desktop row do with the width the phone does not have?',
  intro:
    'Call 12 chose the two-line row, which the phone needs and the desktop wastes. Every option here drops the "you are on" label, keeps the competition button on the right as the one thing that opens the mega menu, and tints the competition part of the bar with the competition theme.',
  frameWidth: 1400,
  options: [
    {
      key: 'a',
      name: 'A · One line, status inline',
      claim: 'The name and the live stage share one line as running text, so the row is as short as the bar above it.',
      cost: 'The status is prose, so it carries no control of its own and cannot open the stage list.',
      verdict: 'rejected',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      name: 'B · Name left, controls right',
      claim:
        'The left holds only the competition, and the live stage joins the competition button as a second control on the right.',
      cost: 'The middle of the row stays empty, which is the space the call set out to use.',
      verdict: 'rejected',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      name: 'C · Pages inline, status right',
      claim:
        'The width does real work: the three pages about the competition sit in the row, and the two controls stay right.',
      cost: 'Three of the seven destinations are stated twice, in the row and in the menu behind the button.',
      verdict: 'chosen',
      load: () => import('./option-c'),
    },
  ],
});
