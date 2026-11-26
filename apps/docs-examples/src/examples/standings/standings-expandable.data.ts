import { NormalizedStandingRow } from '@ethlete/components';

export type Season = { name: string; played: number; wins: number; ties: number; losses: number; points: number };

const team = (id: string, name: string) => ({
  id,
  name,
  code: id.toUpperCase(),
  subtitle: null,
  emblem: null,
  seed: null,
});

export const STANDINGS_ROWS: NormalizedStandingRow[] = [
  {
    id: 'fcb',
    position: 1,
    participant: team('fcb', 'FC Berlin'),
    played: 12,
    wins: 9,
    ties: 1,
    losses: 2,
    points: 28,
    difference: null,
    form: null,
  },
  {
    id: 'neo',
    position: 2,
    participant: team('neo', 'Neon Esports'),
    played: 12,
    wins: 7,
    ties: 2,
    losses: 3,
    points: 23,
    difference: null,
    form: null,
  },
  {
    id: 'rlp',
    position: 3,
    participant: team('rlp', 'Rote Löwen'),
    played: 12,
    wins: 4,
    ties: 1,
    losses: 7,
    points: 13,
    difference: null,
    form: null,
  },
];

export const SEASONS: Record<string, Season[]> = {
  fcb: [
    { name: 'Season 1', played: 6, wins: 4, ties: 1, losses: 1, points: 13 },
    { name: 'Season 2', played: 6, wins: 5, ties: 0, losses: 1, points: 15 },
  ],
  neo: [
    { name: 'Season 1', played: 6, wins: 3, ties: 1, losses: 2, points: 10 },
    { name: 'Season 2', played: 6, wins: 4, ties: 1, losses: 1, points: 13 },
  ],
  rlp: [
    { name: 'Season 1', played: 6, wins: 2, ties: 0, losses: 4, points: 6 },
    { name: 'Season 2', played: 6, wins: 2, ties: 1, losses: 3, points: 7 },
  ],
};
