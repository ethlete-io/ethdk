import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'The bar chart',
  eyebrow: 'Components · bar chart · call 2',
  headline: 'When the app filters a series out, how do the other series keep their colour?',
  intro:
    'Every frame draws the grouped bar chart twice: all three series on the left, the same chart with 2025 filtered out on the right, and the app code below. The palette has three entries, blue, teal and purple. Today a series takes the palette entry at its position in series, so removing one shifts every later series.',
  frameWidth: 900,
  rounds: [
    {
      key: 'r1',
      title: 'Colours through a filter',
      note: 'C won: the docs name colorToken on each series as the way to keep colours. It is explicit at the call site and needs no new API. A repaints the other series, B gives other colours after a reload with a filter on, and D moves the mapping away from the series.',
    },
  ],
  variants: [
    {
      key: 'a',
      verdict: 'rejected',
      round: 'r1',
      name: 'A · Shipped, by position',
      claim:
        'A series takes the palette entry at its index in series. With 2025 filtered out, 2026 moves to index 1 and turns teal.',
      cost: 'A filter recolours every later series, so the reader loses track of which bar is which, unless the app sets colorToken on each series without being told to.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'rejected',
      round: 'r1',
      name: 'B · By key',
      claim:
        'The chart keys the colour on series key: the first render hands out slots in order, and the chart remembers key → slot for its lifetime, so 2026 stays purple. The app code does not change.',
      cost: 'A series added later takes the next free slot, not its position. A reload with the filter already on hands out different slots, so the same series can be another colour on the next visit. The map grows with every key the chart has seen.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      verdict: 'chosen',
      round: 'r1',
      name: 'C · colorToken per series',
      claim:
        'Nothing in the chart changes. The SDK documents colorToken on each series as the way to keep colours stable, and the app sets one per series.',
      cost: 'Every app that filters writes the colour mapping itself, and one that forgets still gets the shift of A. The token names are app-registered, so the docs can only show the pattern, not a default.',
      load: () => import('./variant-c'),
    },
    {
      key: 'd',
      verdict: 'rejected',
      round: 'r1',
      name: 'D · Palette keyed by series key',
      claim:
        'provideColorPalette (or a chart input) maps series keys to tokens. A mapped key keeps its colour through any filter; an unmapped key falls back to its position.',
      cost: 'A new API on the palette, and the mapping lives away from the series it colours. An unmapped key still shifts, and can land on a colour a mapped key already holds.',
      load: () => import('./variant-d'),
    },
  ],
});
