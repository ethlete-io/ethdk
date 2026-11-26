/** One drawn option of the open call, as a tile shows it. */
export type Tile = {
  key: string;
  name: string;
  verdict: '' | 'chosen' | 'rejected';
  round: string;
  /** True for the tile the reader is looking at. Exactly one is true. */
  current?: boolean;
};

/** One pass over the call. A round whose tiles all carry a verdict is settled. */
export type TileRound = {
  key: string;
  title: string;
};

/** The data every option of this call draws. An option may read it and may not change it. */
export const tiles = {
  call: {
    eyebrow: 'Fifagg · call 16',
    headline: 'How does the row carry a 72-character competition name?',
  },
  /** Newest last, the order the passes were drawn in. */
  rounds: [
    { key: 'r1', title: 'What the row leads with' },
    { key: 'r2', title: 'Somebody else gives way' },
    { key: 'r3', title: 'Where the stage name breaks' },
    { key: 'r4', title: 'The row at 320px' },
  ] as TileRound[],
  variants: [
    { key: 'a', name: 'A · The page, then the stage', verdict: 'rejected', round: 'r1' },
    { key: 'b', name: 'B · The stage, then the pages', verdict: 'rejected', round: 'r1' },
    { key: 'c', name: 'C · One line, the control names the page', verdict: 'chosen', round: 'r1' },
    { key: 'd', name: 'D · The stage truncates, the round does not', verdict: 'rejected', round: 'r2' },
    { key: 'e', name: 'E · Two lines, the stage below', verdict: 'chosen', round: 'r2' },
    { key: 'f', name: 'F · The name wraps, the chip moves under it', verdict: 'rejected', round: 'r2' },
    { key: 'g', name: 'G · The break is a hyphen', verdict: 'rejected', round: 'r3' },
    { key: 'h', name: 'H · The break is the last whole word', verdict: 'chosen', round: 'r3' },
    { key: 'i', name: 'I · No break, the row grows', verdict: 'rejected', round: 'r3' },
    { key: 'j', name: 'J · The chip drops to its own line', verdict: '', round: 'r4' },
    { key: 'k', name: 'K · The stage goes to an icon', verdict: '', round: 'r4', current: true },
    { key: 'l', name: 'L · The row splits in two', verdict: '', round: 'r4' },
  ] as Tile[],
};
