import { NO_LIST_REVISIONS, listRevisionsWith } from './list-revisions';

describe('listRevisionsWith', () => {
  it('bumps only the list a call or sketch change names', () => {
    expect(listRevisionsWith(NO_LIST_REVISIONS, [{ kind: 'calls' }, { kind: 'calls' }])).toEqual({
      ...NO_LIST_REVISIONS,
      calls: 1,
    });
    expect(listRevisionsWith(NO_LIST_REVISIONS, [{ kind: 'sketches' }])).toEqual({ ...NO_LIST_REVISIONS, sketches: 1 });
  });

  it('bumps the system lists on a parts change, and every list on a reconnect or an unknown change', () => {
    expect(
      listRevisionsWith(NO_LIST_REVISIONS, [{ kind: 'parts', change: { revision: 1, all: false, parts: [] } }]),
    ).toEqual({ ...NO_LIST_REVISIONS, products: 1, sketches: 1, flows: 1 });
    expect(listRevisionsWith(NO_LIST_REVISIONS, [{ kind: 'all' }, { kind: 'calls' }])).toEqual({
      all: 1,
      products: 1,
      calls: 1,
      sketches: 1,
      flows: 1,
    });
  });

  it('keeps the same revisions for an empty burst', () => {
    expect(listRevisionsWith(NO_LIST_REVISIONS, [])).toBe(NO_LIST_REVISIONS);
  });
});
