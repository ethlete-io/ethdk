import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'The bar chart',
  eyebrow: 'Components · bar chart · call 1',
  headline: 'Should a chart palette follow the surface it sits on, and how?',
  intro:
    'Every frame draws the same grouped bar chart twice: left on a light card, right on a dark card. The palette is tuned for light, a deep blue, teal and purple, so on the dark card the blue nearly disappears. A colour theme has one primary swatch, so today the dark side draws the same hues. Under each pair is the app code that produces it.',
  frameWidth: 900,
  rounds: [
    {
      key: 'r1',
      title: 'A palette on a dark surface',
      note: 'B won: the app gives one palette per surface theme it registered. It is explicit, and the app keeps its own theme names. A leaves weak hues on dark, C ties the palette to a dark or light kind, and the automatic lift of D picks colours the app never chose.',
    },
  ],
  variants: [
    {
      key: 'a',
      verdict: 'rejected',
      round: 'r1',
      name: 'A · Shipped',
      claim:
        'One static palette. The dark card draws the same hues, and an app that cares provides a second palette inside the dark region itself.',
      cost: 'The weak series is the default, and the fix repeats the palette at every dark region, where it drifts out of sync.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'chosen',
      round: 'r1',
      name: 'B · A palette per surface, explicit',
      claim:
        'The app passes one list per surface theme name it registered. The chart reads the surface it sits on and takes that list; the app picks the lighter hues.',
      cost: 'The palette now knows the app’s surface names, a new surface theme needs a new list or falls back to the default, and every list must keep the same series order.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      verdict: 'rejected',
      round: 'r1',
      name: 'C · An entry names a theme per surface kind',
      claim:
        'Each entry names a second theme for dark surfaces. The chart picks by the surface’s dark or light kind, so one list covers every surface.',
      cost: 'The app registers a bright twin of every series theme, and two dark surfaces of different depth get the same hue.',
      load: () => import('./variant-c'),
    },
    {
      key: 'd',
      verdict: 'rejected',
      round: 'r1',
      name: 'D · The SDK lifts the colour on dark',
      claim:
        'Same palette, no app change: on a dark surface the chart mixes each series 35% toward the surface ink, so every hue lifts by the same rule.',
      cost: 'The app does not pick its dark hues, the mix greys and flattens saturated colours, and a palette already tuned for dark gets lifted twice.',
      load: () => import('./variant-d'),
    },
  ],
});
