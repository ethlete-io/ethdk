import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'competition navigation',
  eyebrow: 'Fifagg · call 18',
  headline: 'The call 12 row keeps its shape. What do its two lines say without the name?',
  intro:
    'Call 12 chose a text block on the left and one map control on the right, and call 17 took the competition name out of the row, because the banner art and the page heading both state it already. That leaves the block free. Drawn at 390px above the shipped banner, heading and tabs.',
  frameWidth: 390,
  options: [
    {
      key: 'a',
      name: 'A · The page, then the stage',
      claim: 'Line one is the page you are on, line two the stage that runs now. The row answers "where am I" first.',
      cost: 'The page name is the loud line, and it is the thing the visitor just tapped, so it tells them little.',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      name: 'B · The stage, then the pages',
      claim:
        'Line one is the live stage, in full size. Line two is the quiet line: the page you are on and how many more there are.',
      cost: 'The count is chrome, and the page you are on reads as a footnote to a stage you may not care about.',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      name: 'C · One line, the control names the page',
      claim: 'The block drops to one line, the live stage, and the control on the right states the page instead.',
      cost: 'The row is the shortest of the three, but the control grows and the two facts no longer read as a pair.',
      load: () => import('./option-c'),
    },
  ],
});
