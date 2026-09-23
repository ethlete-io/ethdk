import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'the workspace',
  eyebrow: 'Design tool · call 8',
  headline: 'What stands around the drawing, and how much room is left for it?',
  intro:
    'The workspace is the middle column, about 720px wide once the explorer and the chat have theirs. It has to carry the call it belongs to, the tile column that picks a variant, the drawing itself, what the current variant claims and costs, whether it checks, and the verbs that rule it. Today all of that stacks above and below the drawing, so the drawing gets what is left. Each option gives that furniture a different home.',
  frameWidth: 720,
  rounds: [
    {
      key: 'r1',
      title: 'Where the furniture lives',
      note: 'C wins. The drawing is what the workspace is for, so it takes the whole column and the furniture floats over it and thins away when the pointer leaves. A lost because a fixed head and foot cost the drawing height it never gets back, and it drew the claim and the cost nowhere. B lost because the verbs widened the tile strip into a second sidebar.',
    },
  ],
  variants: [
    {
      key: 'a',
      round: 'r1',
      name: 'A · One head, one foot',
      claim:
        'A single line above the drawing names the call and the round. A single bar below it holds the current variant, its check state and the verbs. The tile column holds nothing but tiles.',
      cost: 'The claim and the cost of the current variant have nowhere to go, so the reader has to remember what the option argued.',
      verdict: 'rejected',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      round: 'r1',
      name: 'B · The verbs follow the tile',
      claim:
        'Ruling happens where a variant is picked: each tile carries its own verdict, and the verb row sits under the tile column. Above the drawing there is only the call headline.',
      cost: 'The verbs are 120px wide, so they stack into a tall column and the tile strip grows into a second sidebar.',
      verdict: 'rejected',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      round: 'r1',
      name: 'C · The drawing is the page',
      claim:
        'The drawing fills the column edge to edge. The call head and the verb bar float over it as translucent bars that thin to a line when the pointer leaves them.',
      cost: 'Two bars cover the top and the bottom of the drawing, which is exactly where a header and a tab bar are drawn.',
      verdict: 'chosen',
      load: () => import('./variant-c'),
    },
  ],
});
