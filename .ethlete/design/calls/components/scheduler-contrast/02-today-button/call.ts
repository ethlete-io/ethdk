import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'Scheduler contrast',
  eyebrow: 'Components · scheduler · call 2',
  headline: 'How does default-theme UI get a readable ink on a light surface?',
  intro:
    'Untyped UI draws in the default colour theme, which sits on :root, and a surface maps only the semantic types error, success and warning. So on light, brand #00ffa1 draws on white at 1.32:1. An axe scan with the root surface on light fails 415 nodes in 41 story groups: buttons, text buttons, chips, links, rich-text tokens and the bracket final. The scheduler today button is one of them. Each frame shows the code and an outline button on light and dark. A, B and D draw the same pixels; they differ in who carries the fix.',
  frameWidth: 720,
  rounds: [
    {
      key: 'r1',
      title: 'Default UI',
      note: 'B won: a surface names its own default colour theme in a colorTheme field, and the semantic map keeps only types. A mixes a theme slot into a map of types, C fixes one button, and D leaves every app without a default that passes.',
    },
  ],
  variants: [
    {
      key: 'a',
      verdict: 'rejected',
      round: 'r1',
      name: 'A · default key in semanticColorThemes',
      claim:
        'A surface maps the default theme the same way it maps a semantic type. Every untyped element on the surface follows.',
      cost: 'Mixes a theme slot into a map of types. The surface must set the theme only where no nearer etProvideColor exists.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'chosen',
      round: 'r1',
      name: 'B · colorTheme field on the surface',
      claim: 'The same remap as A, as its own field. The semantic map keeps only types.',
      cost: 'One more field on SurfaceTheme, with the same nesting rule as A.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      verdict: 'rejected',
      round: 'r1',
      name: 'C · Neutral today button',
      claim: 'The scheduler draws the today button in the surface colour. No core API.',
      cost: 'Fixes one button. The other 400 default-theme nodes on a light surface keep failing.',
      load: () => import('./variant-c'),
    },
    {
      key: 'd',
      verdict: 'rejected',
      round: 'r1',
      name: 'D · The consumer provides the theme',
      claim: 'No SDK change. The app wraps a light region in etProvideColor with its on-light theme.',
      cost: 'Every app must remember it per region. The SDK has no default that passes.',
      load: () => import('./variant-d'),
    },
  ],
});
