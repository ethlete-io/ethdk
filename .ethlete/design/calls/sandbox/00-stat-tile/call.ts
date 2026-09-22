import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'The day summary',
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
    {
      key: 'r2',
      title: 'The frame stays, the third line pays',
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
    {
      key: 'd',
      round: 'r2',
      name: 'D · The change joins the number',
      claim:
        'The hairline frame stays, and the change moves onto the number‘s own baseline, so a tile is two lines. Only a small arrow carries the colour, and the amount reads in the muted ink of the label.',
      cost: 'The direction now rides on one small glyph, so a reader who scans the row at speed takes three numbers and no direction.',
      load: () => import('./option-d'),
    },
    {
      key: 'e',
      round: 'r2',
      name: 'E · One frame, two seams',
      claim:
        'One hairline box holds the whole row and a seam splits the tiles, so the row draws four lines instead of twelve. The change keeps its own line and names itself in muted ink.',
      cost: 'The row reads as one object, so a single tile is harder to take alone, and a direction with no colour must be read, not seen.',
      load: () => import('./option-e'),
    },
    {
      key: 'f',
      round: 'r2',
      name: 'F · The change rides the label',
      claim:
        'The frame stays and the change moves up beside the label, at the label‘s own size and right of it. The colour stays, but it sits on the smallest text in the tile, so the number keeps the weight.',
      cost: 'The change stands far from the number it belongs to, and a long label pushes against it.',
      load: () => import('./option-f'),
    },
  ],
});
