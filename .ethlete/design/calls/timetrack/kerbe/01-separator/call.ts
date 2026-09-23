import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Kerbe · call 1',
  headline: 'What cuts a run of touching bands',
  intro:
    'Four bands of lane:ethlete-sdk meet from 08:45 to 12:15 with no ground between them, so they share one plate tone, and the metal cannot cut them apart because the metal already says what each band asks. The same run, drawn four ways in one lane.',
  frameWidth: 300,
  variants: [
    {
      key: 'a',
      name: 'A · Lit top edge',
      claim:
        "Each plate carries a 1px line in 9% white along its top. It is the plate's own construction and carries no meaning, so it adds nothing to what the metal says.",
      cost: 'It also draws on the first band of a run, where nothing touches.',
      verdict: 'chosen',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      name: 'B · A cut of ground',
      claim:
        'The top pixel is ground, so the run reads as separate slabs and the line vanishes by itself where nothing touches.',
      cost: 'It takes a pixel off every plate, and a 15m band has few to spare.',
      verdict: 'rejected',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      name: 'C · Alternating tone',
      claim: 'Every second plate lifts by about 3% white. No line at all.',
      cost: 'The tone is a band property with no meaning, and it collides with hover, which also lifts.',
      verdict: 'rejected',
      load: () => import('./variant-c'),
    },
    {
      key: 'd',
      name: 'D · Nothing',
      claim: 'The plates share one tone. Only the metal cuts the run, and it restarts at each band.',
      cost: 'Four bands still read as one slab.',
      verdict: 'rejected',
      load: () => import('./variant-d'),
    },
  ],
});
