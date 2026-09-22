import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'competition navigation',
  eyebrow: 'Fifagg · call 21',
  headline: 'What do the chip and the square line up with in the header above?',
  intro:
    'The header carries bare ink: a wordmark on the left, two 22px glyphs on the right, each inside an invisible 40px box. The second row carries two filled shapes. Their edges and their ink cannot both meet the header, so the call is which of the two does. Every option is drawn over the same two guides: the left edge of the wordmark, and the right edge of the burger glyph.',
  frameWidth: 390,
  options: [
    {
      key: 'a',
      verdict: 'chosen',
      name: 'A · The boxes line up',
      claim:
        'The chip and the square keep the header gutter, so the card holds one 16px margin from the top of the logo to the bottom of the row.',
      cost: 'The stage name then starts 13px right of the wordmark, and the grid sits 5px inside the burger glyph.',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      verdict: 'rejected',
      name: 'B · The ink lines up',
      claim:
        'The row is pulled out until the stage name starts under the wordmark and the grid ends under the burger glyph, so what you read lines up down the card.',
      cost: 'The filled shapes then break the gutter the header holds, and the chip sits 4px off the card edge.',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      verdict: 'rejected',
      name: 'C · The row keeps its own gutter',
      claim:
        'A 24px inset marks the second row as content inside the card rather than a second header, so it lines up with nothing above on purpose.',
      cost: 'Three margins then run down one card, and the row reads as indented.',
      load: () => import('./option-c'),
    },
  ],
});
