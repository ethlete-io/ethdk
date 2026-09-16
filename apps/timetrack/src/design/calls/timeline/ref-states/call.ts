import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Timeline · reference',
  headline: 'The block in every state it was drawn in',
  intro:
    'A 45m block in each of the seven states the gallery names, plus the two tiles that share its lane: a band in the background and a break. Each card says what the state asks of the reader. This is the earlier block sketch that the kerbe band replaced, kept as a picture to compare against.',
  frameWidth: 880,
  options: [
    {
      key: 'states',
      name: 'The block, state by state',
      load: () => import('./option-states'),
    },
  ],
});
