import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'The workbench',
  eyebrow: 'Studio · call 4',
  headline: 'What a thumbnail shows when the variant has changed under it',
  intro:
    'Calls 1 to 3 settled the shape of the column and how a tile says it was ruled. Nothing yet says where the picture in a tile comes from. A picture taken once goes out of date the moment the variant behind it is drawn again, and the column exists to be compared against, so a picture that lies costs more than a picture that is slow. Each frame draws the same settled call and the same eight variants, and changes only what a tile does when its picture no longer matches its file. Variants b, e and g have changed since their pictures were taken.',
  frameWidth: 1280,
  options: [
    {
      key: 'a',
      name: 'A · Every tile is live',
      claim:
        'No picture is ever taken. Each tile runs the variant itself, scaled down, so a tile cannot go out of date and the column never carries a mark that is about the tool rather than the work.',
      cost: 'Eight running copies of the drawing sit in one window. Start-up and memory grow with the length of the call, so a call of two dozen variants is out of reach.',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      name: 'B · The old picture, marked',
      claim:
        'The tile keeps the last picture that was taken and carries a small mark saying it is out of date. An old drawing of a variant is still much closer to it than no drawing, so the column stays comparable while it catches up.',
      cost: 'The column shows something that is no longer true, and the reader has to trust a mark to know which tiles to doubt.',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      name: 'C · The tile empties',
      claim:
        'The out-of-date picture is dropped. The tile falls back to a plain plate with the variant name on it until a new picture arrives, so nothing the column shows is ever wrong.',
      cost: 'A hole in the column is a bigger signal than the change that caused it, and a variant with no picture cannot be compared at all.',
      load: () => import('./option-c'),
    },
  ],
});
