import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'The workbench',
  eyebrow: 'Studio · call 2',
  headline: 'How much of a tile carries its own controls',
  intro:
    'Call 1 settled the layout: the thumbnails stand in one narrow column and the variant under study takes the rest. The column is narrow, so a tile has little room, and every control on it costs the picture space. Each frame draws the same workbench, the same eight variants and the same large variant, and changes only what a thumbnail carries beside its picture.',
  frameWidth: 1280,
  rounds: [
    {
      key: 'r1',
      title: 'What a thumbnail carries',
      note: 'A won. The user ruled the controls out of the column: "i dont think these controls are needed there." B paid a third of every tile for two controls, and C hid them behind a pointer that a touch screen does not have. So a thumbnail stays a picture, and every verb belongs to the variant under study. The user also rejected the word on a ruled tile - "rejected also doesnt need to be text" - which call 3 takes up.',
    },
  ],
  variants: [
    {
      key: 'a',
      round: 'r1',
      verdict: 'chosen',
      name: 'A · The picture alone',
      claim:
        'A tile holds its picture, its name and a verdict marker, and nothing that can be pressed. Every verb belongs to the large variant, so the column stays a row of pictures and the picture gets all the width the column has.',
      cost: 'Ruling on a variant takes two steps: put it large, then press the verb. Settling a round of eight is therefore sixteen actions.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      round: 'r1',
      verdict: 'rejected',
      name: 'B · The verdict on every tile',
      claim:
        'Each tile carries two small controls, accept and reject, under its picture. Settling a whole round never leaves the column, and what is already ruled reads at a glance.',
      cost: 'Two controls plus a name under every picture take about a third of the tile, so the picture shrinks in the one dimension the column can least spare.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      round: 'r1',
      verdict: 'rejected',
      name: 'C · The controls under the pointer',
      claim:
        'A tile shows its picture alone until the pointer rests on it, and then the four verbs lie over the foot of that tile. Nothing is given up in the resting state, and every verb is one action away.',
      cost: 'The controls are invisible until they are found, only one tile can show them, and a touch screen has no pointer to rest.',
      load: () => import('./variant-c'),
    },
  ],
});
