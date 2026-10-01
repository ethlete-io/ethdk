import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'The Sankey chart',
  eyebrow: 'Components · sankey chart · call 1',
  headline: 'What does a Sankey do on a narrow screen?',
  intro:
    'Every frame is a 360px phone showing the same four-column signup funnel: three sources, two pages, signed up or left, then activated or dormant. The shipped chart keeps a 480px minimum plot width, so on this screen something has to give.',
  frameWidth: 360,
  rounds: [
    {
      key: 'r1',
      title: 'Narrow screens',
      note: 'C won: below a breakpoint the flow turns vertical, and columns become rows read top to bottom. Labels get the full width and nothing scrolls. A hides part of the plot, B cuts the labels, and D drops the picture.',
    },
  ],
  variants: [
    {
      key: 'a',
      verdict: 'rejected',
      round: 'r1',
      name: 'A · Shipped',
      claim:
        'The plot keeps its 480px minimum (--et-sankey-chart-min-width) and scrolls sideways, so the geometry and labels stay as on desktop.',
      cost: 'The last column and its labels start off screen, a sideways scroll is easy to miss, and it fights a page that scrolls vertically.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'rejected',
      round: 'r1',
      name: 'B · Squeeze to fit',
      claim: 'The plot shrinks to the screen width and the label gutters narrow, so the whole flow is visible at once.',
      cost: 'The ribbons get short and steep, and the middle labels truncate to a few letters, so the names need a tap to read.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      verdict: 'chosen',
      round: 'r1',
      name: 'C · Vertical flow',
      claim:
        'Below a breakpoint the flow turns 90 degrees: columns become rows read top to bottom, and the phone width carries the node sizes.',
      cost: 'The chart grows tall, labels on small nodes crowd their neighbours, and the layout code needs a second orientation.',
      load: () => import('./variant-c'),
    },
    {
      key: 'd',
      verdict: 'rejected',
      round: 'r1',
      name: 'D · Table view',
      claim:
        'Below a breakpoint the chart shows its existing data table (from, to, visitors) in place of the plot, so every value reads exactly.',
      cost: 'The flow picture is gone, which is the reason to pick a Sankey, and eleven rows are longer than the chart was tall.',
      load: () => import('./variant-d'),
    },
  ],
});
