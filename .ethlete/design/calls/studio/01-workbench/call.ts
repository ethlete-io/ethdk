import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'The workbench',
  eyebrow: 'Studio · call 1',
  headline: 'Where the large variant sits against the grid of the others',
  intro:
    'Studio shows one variant at a time, so nothing says what the other seven look like. The workbench draws every variant of the open call at once, with one of them large enough to judge. Each frame holds the same call, the same eight variants, the same picture in each tile and the same verbs, and changes only where the large one sits against the grid.',
  frameWidth: 1280,
  rounds: [
    {
      key: 'r1',
      title: 'Where the large variant sits',
      note: 'A won. A drawing of an application is tall as well as wide, and A is the only layout that gives the variant under study the full height of the window. B spent that height on a strip of thumbnails to buy width the drawing did not need, and its row is already full at eight variants, so a longer call pushes the large one off the screen. C never made the large variant large: two cells by two is about twice a thumbnail, which is too small to judge fine work, and the span left a hole in the grid it claimed to keep even.',
    },
  ],
  variants: [
    {
      key: 'a',
      round: 'r1',
      verdict: 'chosen',
      name: 'A · The grid beside it',
      claim:
        'The thumbnails stand in one narrow column at the left of the stage, and the large variant takes the rest of the width. The eye moves sideways between the two, and the large one keeps the full height of the window.',
      cost: 'A narrow column holds few thumbnails, so a call of two dozen variants scrolls, and each picture is too small to tell two close variants apart.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      round: 'r1',
      verdict: 'rejected',
      name: 'B · The grid under it',
      claim:
        'The large variant sits across the full width at the top, and the thumbnails run under it as a wide strip. The large one gets every pixel of width, which is the dimension a drawing of an application needs.',
      cost: 'The strip takes height from the large variant, and a call of two dozen variants needs several rows, which pushes the large one off the screen.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      round: 'r1',
      verdict: 'rejected',
      name: 'C · Large in its own place',
      claim:
        'Every variant keeps one cell of one even grid, and the variant under study grows in the cell it already holds. Nothing moves to another place, so the reader never loses which tile is which.',
      cost: 'The large variant is only about twice a thumbnail, so it is still too small for fine work, and the grid reflows around the grown cell.',
      load: () => import('./variant-c'),
    },
  ],
});
