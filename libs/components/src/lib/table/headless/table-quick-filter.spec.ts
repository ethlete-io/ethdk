import { TableColumns } from '../table.types';
import { quickFilterRows } from './table-quick-filter';

type Player = { name: string; team: { city: string }; number: number; active: boolean };

const PLAYERS: Player[] = [
  { name: 'Ada Lovelace', team: { city: 'London' }, number: 7, active: true },
  { name: 'Grace Hopper', team: { city: 'New York' }, number: 23, active: false },
  { name: 'Alan Turing', team: { city: 'London' }, number: 10, active: true },
];

const COLUMNS = {
  name: { value: (player) => player.name },
  team: { value: (player) => player.team },
  number: { value: (player) => player.number },
  active: { value: (player) => player.active },
} satisfies TableColumns<Player>;

const names = (rows: Player[]) => rows.map((player) => player.name);

describe('quickFilterRows', () => {
  it('passes every row through for an empty or blank query', () => {
    expect(quickFilterRows({ rows: PLAYERS, query: '', columns: COLUMNS })).toHaveLength(3);
    expect(quickFilterRows({ rows: PLAYERS, query: '   ', columns: COLUMNS })).toHaveLength(3);
    expect(quickFilterRows({ rows: PLAYERS, query: null, columns: COLUMNS })).toHaveLength(3);
  });

  it('matches case-insensitively and needs every word somewhere in the row', () => {
    expect(names(quickFilterRows({ rows: PLAYERS, query: 'aDa', columns: COLUMNS }))).toEqual(['Ada Lovelace']);
    expect(names(quickFilterRows({ rows: PLAYERS, query: 'a 23', columns: COLUMNS }))).toEqual(['Grace Hopper']);
    expect(names(quickFilterRows({ rows: PLAYERS, query: 'ada turing', columns: COLUMNS }))).toEqual([]);
  });

  it('searches numbers and skips values that are neither a string nor a number', () => {
    expect(names(quickFilterRows({ rows: PLAYERS, query: '10', columns: COLUMNS }))).toEqual(['Alan Turing']);
    expect(quickFilterRows({ rows: PLAYERS, query: 'object', columns: COLUMNS })).toEqual([]);
    expect(quickFilterRows({ rows: PLAYERS, query: 'true', columns: COLUMNS })).toEqual([]);
  });

  it('searches a column through its quickFilterValue, and leaves out one with quickFilter: false', () => {
    const columns = {
      ...COLUMNS,
      name: { value: (player) => player.name, quickFilter: false },
      team: { value: (player) => player.team, quickFilterValue: (player) => player.team.city },
    } satisfies TableColumns<Player>;

    expect(names(quickFilterRows({ rows: PLAYERS, query: 'york', columns }))).toEqual(['Grace Hopper']);
    expect(quickFilterRows({ rows: PLAYERS, query: 'ada', columns })).toEqual([]);
  });

  it('does not match a word across two columns', () => {
    expect(quickFilterRows({ rows: PLAYERS, query: 'lovelace7', columns: COLUMNS })).toEqual([]);
  });
});
