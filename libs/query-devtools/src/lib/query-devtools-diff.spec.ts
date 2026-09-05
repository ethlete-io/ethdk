import { diffQueryDevtoolsResponses, formatJsonPath } from './query-devtools-diff';

describe('diffQueryDevtoolsResponses', () => {
  it('should report nothing for two equal responses', () => {
    const value = { a: 1, list: [{ id: 1, name: 'x' }] };

    expect(diffQueryDevtoolsResponses(value, structuredClone(value))).toEqual({ entries: [], truncated: false });
  });

  it('should report a changed leaf by its path', () => {
    const diff = diffQueryDevtoolsResponses({ a: { b: 1 } }, { a: { b: 2 } });

    expect(diff.entries).toEqual([{ path: '$.a.b', kind: 'changed', before: 1, after: 2 }]);
  });

  it('should tell an added key from a removed one', () => {
    const diff = diffQueryDevtoolsResponses({ gone: 1 }, { fresh: 2 });

    expect(diff.entries).toEqual([
      { path: '$.gone', kind: 'removed', before: 1, after: null },
      { path: '$.fresh', kind: 'added', before: null, after: 2 },
    ]);
  });

  it('should report a key whose value became undefined as changed, not removed', () => {
    const diff = diffQueryDevtoolsResponses({ a: 1 }, { a: undefined });

    expect(diff.entries).toEqual([{ path: '$.a', kind: 'changed', before: 1, after: undefined }]);
  });

  it('should compare a plain array by index', () => {
    const diff = diffQueryDevtoolsResponses([1, 2, 3], [1, 9]);

    expect(diff.entries).toEqual([
      { path: '$[1]', kind: 'changed', before: 2, after: 9 },
      { path: '$[2]', kind: 'removed', before: 3, after: null },
    ]);
  });

  it('should match records by id so a prepended item does not shift every path', () => {
    const before = [
      { id: 2, score: 1 },
      { id: 3, score: 2 },
    ];
    const after = [
      { id: 1, score: 0 },
      { id: 2, score: 1 },
      { id: 3, score: 2 },
    ];

    const diff = diffQueryDevtoolsResponses(before, after);

    expect(diff.entries).toEqual([{ path: '$[id=1]', kind: 'added', before: null, after: { id: 1, score: 0 } }]);
  });

  it('should report a removed record by its id', () => {
    const diff = diffQueryDevtoolsResponses([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }]);

    expect(diff.entries).toEqual([{ path: '$[id=a]', kind: 'removed', before: { id: 'a' }, after: null }]);
  });

  it('should fall back to index comparison when ids repeat', () => {
    const diff = diffQueryDevtoolsResponses(
      [
        { id: 1, v: 1 },
        { id: 1, v: 2 },
      ],
      [
        { id: 1, v: 1 },
        { id: 1, v: 3 },
      ],
    );

    expect(diff.entries).toEqual([{ path: '$[1].v', kind: 'changed', before: 2, after: 3 }]);
  });

  it('should report a type change as one entry rather than descending into it', () => {
    const diff = diffQueryDevtoolsResponses({ a: { b: 1 } }, { a: 'gone' });

    expect(diff.entries).toEqual([{ path: '$.a', kind: 'changed', before: { b: 1 }, after: 'gone' }]);
  });

  it('should stop descending at the depth cap and compare the subtree as a whole', () => {
    const nest = (depth: number, leaf: unknown): unknown => (depth === 0 ? leaf : { down: nest(depth - 1, leaf) });
    const path = `$${'.down'.repeat(12)}`;

    const diff = diffQueryDevtoolsResponses(nest(14, 1), nest(14, 2));

    expect(diff.entries.length).toBe(1);
    expect(diff.entries[0]?.path).toBe(path);
    expect(diff.entries[0]?.kind).toBe('changed');
  });

  it('should survive a circular response instead of throwing', () => {
    const circular: Record<string, unknown> = { a: 1 };
    circular['self'] = circular;

    expect(() => diffQueryDevtoolsResponses(circular, { a: 1 })).not.toThrow();
  });

  it('should cap the entry list and say so', () => {
    const build = (offset: number) => Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`k${i}`, i + offset]));

    const diff = diffQueryDevtoolsResponses(build(0), build(1));

    expect(diff.entries.length).toBe(200);
    expect(diff.truncated).toBe(true);
  });

  it('should report a changed Blob body rather than reading it as identical', () => {
    const diff = diffQueryDevtoolsResponses(
      new Blob(['a'.repeat(10)], { type: 'text/plain' }),
      new Blob(['b'.repeat(4000)], { type: 'application/pdf' }),
    );

    expect(diff.entries.map((entry) => entry.path)).toEqual(['$']);
    expect(diff.entries[0]?.kind).toBe('changed');
  });

  it('should read two Blobs of the same size and type as identical', () => {
    const diff = diffQueryDevtoolsResponses(
      new Blob(['ab'], { type: 'text/plain' }),
      new Blob(['cd'], { type: 'text/plain' }),
    );

    expect(diff.entries).toEqual([]);
  });

  it('should report a changed ArrayBuffer body', () => {
    const diff = diffQueryDevtoolsResponses(new ArrayBuffer(8), new ArrayBuffer(4096));

    expect(diff.entries.map((entry) => entry.path)).toEqual(['$']);
  });

  it('should report a changed Date, Map and Set nested in a response', () => {
    const diff = diffQueryDevtoolsResponses(
      { at: new Date(0), by: new Map([['a', 1]]), tags: new Set(['x']) },
      { at: new Date(1_000), by: new Map([['a', 2]]), tags: new Set(['y']) },
    );

    expect(diff.entries.map((entry) => entry.path).sort()).toEqual(['$.at', '$.by', '$.tags']);
  });

  it('should read two equal Dates as identical', () => {
    expect(diffQueryDevtoolsResponses({ at: new Date(5) }, { at: new Date(5) }).entries).toEqual([]);
  });

  it('should report a value that stopped being a Date', () => {
    const diff = diffQueryDevtoolsResponses({ at: new Date(0) }, { at: { year: 1970 } });

    expect(diff.entries.map((entry) => entry.path)).toEqual(['$.at']);
  });

  it('should compare two non-object responses directly', () => {
    expect(diffQueryDevtoolsResponses(null, 5).entries).toEqual([
      { path: '$', kind: 'changed', before: null, after: 5 },
    ]);
    expect(diffQueryDevtoolsResponses('same', 'same').entries).toEqual([]);
  });
});

describe('formatJsonPath', () => {
  it('should format an empty path as the root the diff column uses', () => {
    expect(formatJsonPath([])).toBe('$');
  });

  it('should join keys with dots and indices with brackets', () => {
    expect(formatJsonPath(['data', 'items', 0, 'title'])).toBe('$.data.items[0].title');
  });

  it('should match the path the diff reports for the same location', () => {
    const diff = diffQueryDevtoolsResponses(
      { data: { items: [{ title: 'a' }] } },
      { data: { items: [{ title: 'b' }] } },
    );

    expect(diff.entries[0]?.path).toBe(formatJsonPath(['data', 'items', 0, 'title']));
  });
});
