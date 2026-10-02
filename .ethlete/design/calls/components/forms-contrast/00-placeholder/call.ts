import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'Forms contrast',
  eyebrow: 'Components · forms · call 0',
  headline: 'Which colour does the select and cascader placeholder take?',
  intro:
    'The select and the cascader draw their placeholder as a 46% mix of the text colour. That is 4.5:1 on dark and 3.0:1 on light, and axe fails it on the dark stories at 4.47:1. Their panel search fields already use the muted colour for the placeholder. Each frame draws an empty and a filled trigger on four surfaces.',
  frameWidth: 720,
  rounds: [
    {
      key: 'r1',
      title: 'Placeholder',
      note: 'B won: the placeholder takes muted, as the panel search field does. A fails AA on light, and C adds a second grey next to muted.',
    },
  ],
  variants: [
    {
      key: 'a',
      verdict: 'rejected',
      round: 'r1',
      name: 'A · Shipped 46% mix',
      claim: 'The placeholder is 46% of the text colour.',
      cost: 'Under AA on light, light-elevated and dark-elevated, and on the edge on dark.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'chosen',
      round: 'r1',
      name: 'B · Muted',
      claim: 'The placeholder takes the muted surface colour, the same as the search field in the panel.',
      cost: 'A placeholder and a hint now share one colour.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      verdict: 'rejected',
      round: 'r1',
      name: 'C · 60% mix',
      claim: 'Keep the mix, with more of the text colour, so the placeholder follows any surface without a token.',
      cost: 'A second grey next to muted. The amount clears AA only on these four surfaces.',
      load: () => import('./variant-c'),
    },
  ],
});
