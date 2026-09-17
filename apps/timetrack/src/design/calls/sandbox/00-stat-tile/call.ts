import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Sandbox · call 0',
  headline: 'How a summary tile carries its number',
  intro:
    'A call with no stake in any app, kept so Studio has something to drive. Three tiles sit in one row above a day: a duration, a second duration and a count. Each frame draws the same three numbers and the same three labels, and changes only how much chrome the tile wears and whether the change since yesterday is drawn at all.',
  frameWidth: 720,
  rounds: [
    {
      key: 'r1',
      title: 'How much a tile wears',
      note: '',
    },
  ],
  options: [
    {
      key: 'a',
      round: 'r1',
      name: 'A · The number alone',
      claim:
        'No frame, no plate and no change. The number is the largest thing in the row and the label sits under it in small capitals, so the reader takes three numbers and stops.',
      cost: 'Nothing says whether a number is good or bad, and a row of bare numbers has no edge to separate one tile from the next.',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      round: 'r1',
      name: 'B · A hairline frame and the change',
      claim:
        'Each tile takes a 1px frame and the label leads above the number. The change since yesterday reads under it in green or red, so a number gets a direction without a second screen.',
      cost: 'Three frames put nine lines in a row that carries three facts, and the colour makes the change louder than the number it belongs to.',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      round: 'r1',
      name: 'C · A plate, the change beside the number',
      claim:
        'The frame becomes a filled plate with a soft corner, and the change sits on the number‘s own baseline. The tile reads as one object and the row needs no separator.',
      cost: 'The plates are the brightest thing on the page, and a summary row above a day is the one place that should stay quiet.',
      load: () => import('./option-c'),
    },
  ],
});
