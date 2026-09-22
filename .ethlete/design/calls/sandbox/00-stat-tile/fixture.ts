/** One number a day summary puts in front of the reader. */
export type Tile = {
  label: string;
  value: string;
  change: string;
  rising: boolean;
};

export const TILES: Tile[] = [
  { label: 'Tracked today', value: '6h 15m', change: '+45m', rising: true },
  { label: 'Still unnamed', value: '1h 30m', change: '-15m', rising: false },
  { label: 'Open tickets', value: '4', change: '+1', rising: true },
];

export const GROUND = '#14161a';
export const PLATE = '#1b1e24';
export const LINE = '#2b2f36';
export const INK = '#e8e6e1';
export const MUTED = '#868b93';
export const UP = '#7fb08a';
export const DOWN = '#c07d72';
