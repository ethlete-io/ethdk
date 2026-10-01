import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'The sankey chart',
  eyebrow: 'Components · sankey chart · call 0',
  headline: 'Where do the labels of middle-column nodes go?',
  intro:
    'Every frame draws the same four-column signup funnel at the shipped defaults: 320px tall, 12px nodes and gaps, 120px kept for the outer labels. The first and last columns label as shipped; only the two middle columns, whose names run long, change.',
  frameWidth: 720,
  rounds: [
    {
      key: 'r1',
      title: 'Middle labels',
      note: 'B won: a middle label sits on a surface chip centred on its node, and a node under 24px keeps the shipped label. The label stays on its node and leaves the ribbons free. A cuts long names, C collides with the node above in a 12px gap, and D hides the names.',
    },
  ],
  variants: [
    {
      key: 'a',
      verdict: 'rejected',
      round: 'r1',
      name: 'A · Shipped',
      claim:
        'A middle label sits right of its node, over the outgoing ribbons, with a surface halo and an ellipsis at the next column.',
      cost: 'The text competes with the ribbons it covers, and a long name loses its end to the ellipsis.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'chosen',
      round: 'r1',
      name: 'B · Chip on the node',
      claim:
        'A middle label sits on a surface chip centred on its node when the node is at least 24px tall, otherwise right of it as shipped.',
      cost: 'The chip hides the node bar and the ribbon ends under it, and a short node falls back to the shipped look, so one chart mixes two styles.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      verdict: 'rejected',
      round: 'r1',
      name: 'C · Above the node',
      claim: 'A middle label sits above its node, starting at its left edge, so it never crosses the node itself.',
      cost: 'At the shipped 12px gap the text still overlaps the node above and the ribbons, so it needs a gap of about 20px, which shrinks every node.',
      load: () => import('./variant-c'),
    },
    {
      key: 'd',
      verdict: 'rejected',
      round: 'r1',
      name: 'D · Tooltip only',
      claim:
        'Middle nodes draw no label; their name shows in the tooltip on hover or focus, drawn here on the landing page node.',
      cost: 'The chart cannot be read at a glance or in a screenshot, and touch users must tap every node to learn what it is.',
      load: () => import('./variant-d'),
    },
  ],
});
