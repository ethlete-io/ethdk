import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'The bar chart',
  eyebrow: 'Components · bar chart · call 0',
  headline: 'What colours do several series get when the app provides no palette?',
  intro:
    'Every frame draws the same grouped vertical bar chart: three series, 2024 to 2026, over Q1 to Q4, with the shipped legend above the plot. The app has no provideColorPalette, so the chart has one accent to work with.',
  frameWidth: 520,
  rounds: [
    {
      key: 'r1',
      title: 'Colours without a palette',
      note: 'C won: steps of the accent, the same rule as the pie chart. A gives series you cannot tell apart, B stops an app that only wants a quick chart, and the patterns of D are busy at bar size.',
    },
  ],
  variants: [
    {
      key: 'a',
      verdict: 'rejected',
      round: 'r1',
      name: 'A · Shipped',
      claim: 'Every series takes the theme accent, and a dev console.warn says the series share one colour.',
      cost: 'The three series cannot be told apart, in the bars or in the legend, and the warning is easy to miss.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'rejected',
      round: 'r1',
      name: 'B · An error',
      claim:
        'The chart draws a dev error in place of the bars and no legend, so a missing palette is caught before it ships.',
      cost: 'A chart that worked with one series breaks when a second is added, and a production build still needs a fallback colour.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      verdict: 'chosen',
      round: 'r1',
      name: 'C · Accent steps',
      claim:
        'The series step from the full accent down to a 40% mix with the surface, evenly spaced, the rule the pie chart uses. The legend swatches match.',
      cost: 'The steps read as an order, light to dark, which a set of unrelated series does not have, and past four series the steps get too close to tell apart.',
      load: () => import('./variant-c'),
    },
    {
      key: 'd',
      verdict: 'rejected',
      round: 'r1',
      name: 'D · Accent plus pattern',
      claim:
        'Every series keeps the full accent, and series 2 and 3 add a diagonal hatch and a dot pattern. The legend swatches show the pattern.',
      cost: 'Patterns are noisy on narrow bars and in a 10px swatch, and only a few of them read before they blur into each other.',
      load: () => import('./variant-d'),
    },
  ],
});
