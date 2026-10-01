import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'The pie chart',
  eyebrow: 'Components · pie chart · call 3',
  headline: 'Should the pie keep its own legend, or share one with the bar and line charts?',
  intro:
    'Every frame draws the same seven traffic channels as the shipped 200px donut with its total, coloured from an app palette: one slice under 1% and one long label. Each variant shows a full-width container, then a 300px one. The shipped pie legend lists swatch, label, value and share beside the circle; the shared et-chart-legend of the bar and line charts is a wrapping row of swatch and label above the plot.',
  frameWidth: 720,
  rounds: [
    {
      key: 'r1',
      title: 'Legend',
      note: 'A won: the pie keeps its own legend of swatch, label, value and share beside the circle. The aligned columns let the values be compared. B breaks the columns, C hides how small the SMS slice is, and D leaves a wide container empty beside the circle.',
    },
  ],
  variants: [
    {
      key: 'a',
      verdict: 'chosen',
      round: 'r1',
      name: 'A · Shipped',
      claim:
        'The pie keeps its own legend: a four-column grid of swatch, label, value and share beside the circle, at most 360px wide, wrapping below it when the container is narrow.',
      cost: 'Two legend components with two looks and two sets of tokens, and the pie reads differently from a bar chart on the same dashboard.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'rejected',
      round: 'r1',
      name: 'B · Shared legend with values',
      claim:
        'et-chart-legend gains an optional value and share per item, and the pie uses it above the circle like the bar and line charts do.',
      cost: 'The values sit inline after each label instead of in columns, so they cannot be compared down a column, and the row wraps unevenly.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      verdict: 'rejected',
      round: 'r1',
      name: 'C · Shared legend, values in the tooltip',
      claim:
        'The pie uses the plain shared legend, swatch and label only; value and share move to the tooltip (drawn hovering Organic search) and the table view.',
      cost: 'Nothing on screen says how big the 0.3% SMS slice is, and touch users must tap each slice; a screenshot loses every number.',
      load: () => import('./variant-c'),
    },
    {
      key: 'd',
      verdict: 'rejected',
      round: 'r1',
      name: 'D · Own legend, always below',
      claim:
        'The pie keeps its own value-and-share legend but always below the circle, as a compact list that flows into columns of at least 260px.',
      cost: 'A wide container leaves empty space beside the circle and the chart grows taller, and it still differs from the shared legend.',
      load: () => import('./variant-d'),
    },
  ],
});
