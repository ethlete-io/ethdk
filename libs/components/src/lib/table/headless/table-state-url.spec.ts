import { deserializeTableState, serializeTableState } from './table-state-url';
import { TableState } from '../table.types';

const STATE: TableState = {
  v: 1,
  columns: [
    { key: 'name', hidden: false, sort: 'asc' },
    { key: 'role', hidden: true, filterValues: ['Admin', 'Editor'] },
  ],
  expanded: ['1', '2'],
};

describe('table state URL adapter', () => {
  it('round-trips a state through serialize → deserialize', () => {
    expect(deserializeTableState(serializeTableState(STATE))).toEqual(STATE);
  });

  it('returns null for absent input', () => {
    expect(deserializeTableState(null)).toBeNull();
    expect(deserializeTableState(undefined)).toBeNull();
    expect(deserializeTableState('')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(deserializeTableState('{not json')).toBeNull();
  });

  it('reads both known versions — v1 predates the feature slices', () => {
    expect(deserializeTableState(JSON.stringify({ v: 1, columns: [] }))).toEqual({ v: 1, columns: [] });
    expect(deserializeTableState(JSON.stringify({ v: 2, columns: [], features: { selection: ['1'] } }))).toEqual({
      v: 2,
      columns: [],
      features: { selection: ['1'] },
    });
  });

  it('returns null for an unknown version or missing columns', () => {
    expect(deserializeTableState(JSON.stringify({ v: 3, columns: [] }))).toBeNull();
    expect(deserializeTableState(JSON.stringify({ v: 1 }))).toBeNull();
    expect(deserializeTableState(JSON.stringify('a string'))).toBeNull();
  });
});
