import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'The Sankey chart',
  eyebrow: 'Components · sankey chart · call 2',
  headline: "How does a keyboard user move through a Sankey's links?",
  intro:
    'Every frame draws the same flow: four sources into two pools into four uses, ten nodes and twelve links. The badges and the key legend show the presses that reach the link Reserve → Staff; a dashed outline marks every tab stop, the blue ring the focused element.',
  frameWidth: 560,
  rounds: [
    {
      key: 'r1',
      title: 'Moving through the links',
      note: 'B won: the chart is one tab stop with roving focus. The arrow keys walk the nodes, and Enter steps into the outgoing links of a node. A costs a tab stop per node and link, C never focuses a link, and D cannot reach a link that does not lead on.',
    },
  ],
  variants: [
    {
      key: 'a',
      verdict: 'rejected',
      round: 'r1',
      name: 'A · Shipped',
      claim: 'Every node, then every link, is a tab stop in source order, with no arrow keys.',
      cost: 'Twelve links make 22 tab stops before Tab leaves the chart, and reaching one link means tabbing past every node first, so the table view is the faster route.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'chosen',
      round: 'r1',
      name: 'B · Roving focus',
      claim:
        'The chart is one tab stop; arrows walk the nodes by column, Enter steps into a node’s outgoing links, ↑↓ cycle them and Esc returns.',
      cost: 'Two modes to learn with no visible hint outside the tooltip, arrow keys clash with screen-reader browse mode, and it is the most code of the four.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      verdict: 'rejected',
      round: 'r1',
      name: 'C · Nodes only',
      claim:
        'Only nodes are tab stops; a focused node’s tooltip lists its In/Out totals and each outgoing link with its value.',
      cost: 'A single link is never highlighted on its own, the tooltip grows with a node’s link count, and incoming links are only read from the source side or the table.',
      load: () => import('./variant-c'),
    },
    {
      key: 'd',
      verdict: 'rejected',
      round: 'r1',
      name: 'D · Follow the flow',
      claim:
        'Tab reaches the nodes only; from a node → moves along its first outgoing link and on to the target, ← walks back, ↑↓ switch sibling links.',
      cost: 'Still ten tab stops, the arrows only work once a node has focus and nothing shows they exist, and the wrong first link costs extra ↑↓ presses.',
      load: () => import('./variant-d'),
    },
  ],
});
