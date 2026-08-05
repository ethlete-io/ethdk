import {
  applyQueryDevtoolsOverrides,
  createQueryDevtoolsOverrides,
  detectPaginationShape,
} from './query-devtools-overrides';

describe('query devtools overrides', () => {
  describe('createQueryDevtoolsOverrides', () => {
    it('should arm ops and list them in arming order', () => {
      const recorder = createQueryDevtoolsOverrides();

      recorder.arm({ type: 'set', path: ['a'], value: 1 });
      recorder.arm({ type: 'booleanFlip', path: ['b'] });

      expect(recorder.list().map((entry) => entry.op.type)).toEqual(['set', 'booleanFlip']);
    });

    it('should clear one op by id and leave the rest', () => {
      const recorder = createQueryDevtoolsOverrides();

      recorder.arm({ type: 'set', path: ['a'], value: 1 });
      recorder.arm({ type: 'set', path: ['b'], value: 2 });

      const [first, second] = recorder.list();
      recorder.clear(first!.id);

      expect(recorder.list()).toEqual([second]);
    });

    it('should clear every op on clearAll', () => {
      const recorder = createQueryDevtoolsOverrides();

      recorder.arm({ type: 'set', path: ['a'], value: 1 });
      recorder.arm({ type: 'set', path: ['b'], value: 2 });
      recorder.clearAll();

      expect(recorder.list()).toEqual([]);
    });

    it('should not store a reset op, and instead disarm ops already at its exact path', () => {
      const recorder = createQueryDevtoolsOverrides();

      recorder.arm({ type: 'set', path: ['a', 'b'], value: 1 });
      recorder.arm({ type: 'set', path: ['a', 'c'], value: 2 });
      recorder.arm({ type: 'reset', path: ['a', 'b'] });

      expect(recorder.list().map((entry) => entry.op.path)).toEqual([['a', 'c']]);
    });

    it('should apply armed ops to a raw response', () => {
      const recorder = createQueryDevtoolsOverrides();

      recorder.arm({ type: 'set', path: ['name'], value: 'Ada' });

      expect(recorder.apply({ name: 'Grace' })).toEqual({ name: 'Ada' });
    });
  });

  describe('applyQueryDevtoolsOverrides', () => {
    it('should replay ops against the current raw value, not a frozen snapshot', () => {
      const entries = [{ id: '1', op: { type: 'set' as const, path: ['count'], value: 42 } }];

      expect(applyQueryDevtoolsOverrides(entries, { count: 1 }).value).toEqual({ count: 42 });
      expect(applyQueryDevtoolsOverrides(entries, { count: 999 }).value).toEqual({ count: 42 });
    });

    it('should not mutate the raw input', () => {
      const raw = { user: { name: 'Grace' } };
      const entries = [{ id: '1', op: { type: 'set' as const, path: ['user', 'name'], value: 'Ada' } }];

      const { value } = applyQueryDevtoolsOverrides(entries, raw);

      expect(raw.user.name).toBe('Grace');
      expect((value as typeof raw).user.name).toBe('Ada');
      // Only the touched branch is cloned - a sibling that was not touched keeps its identity.
      expect(value).not.toBe(raw);
    });

    it('should flag an op stale and skip it when its path no longer resolves', () => {
      const entries = [{ id: 'stale', op: { type: 'set' as const, path: ['missing', 'deep'], value: 1 } }];

      const { value, staleIds } = applyQueryDevtoolsOverrides(entries, { other: true });

      expect(staleIds).toEqual(['stale']);
      expect(value).toEqual({ other: true });
    });

    it('should let a later op apply even when an earlier one is stale', () => {
      const entries = [
        { id: 'stale', op: { type: 'set' as const, path: ['missing', 'deep'], value: 1 } },
        { id: 'ok', op: { type: 'set' as const, path: ['name'], value: 'Ada' } },
      ];

      const { value, staleIds } = applyQueryDevtoolsOverrides(entries, { name: 'Grace' });

      expect(staleIds).toEqual(['stale']);
      expect(value).toEqual({ name: 'Ada' });
    });

    it('should flip a boolean, and flag stale if the value is not a boolean', () => {
      const flip = [{ id: '1', op: { type: 'booleanFlip' as const, path: ['active'] } }];

      expect(applyQueryDevtoolsOverrides(flip, { active: true }).value).toEqual({ active: false });
      expect(applyQueryDevtoolsOverrides(flip, { active: 'yes' }).staleIds).toEqual(['1']);
      expect(applyQueryDevtoolsOverrides(flip, {}).staleIds).toEqual(['1']);
    });

    it('should apply string presets, falling back to an empty string for an unset custom value', () => {
      const preset = (preset: 'short' | 'long' | 'unicode' | 'custom', custom?: string) => [
        { id: '1', op: { type: 'stringPreset' as const, path: ['name'], preset, custom } },
      ];

      expect(applyQueryDevtoolsOverrides(preset('short'), { name: 'x' }).value).toEqual({ name: 'Ab' });
      expect(applyQueryDevtoolsOverrides(preset('custom', 'hi'), { name: 'x' }).value).toEqual({ name: 'hi' });
      expect(applyQueryDevtoolsOverrides(preset('custom'), { name: 'x' }).value).toEqual({ name: '' });
      expect((applyQueryDevtoolsOverrides(preset('unicode'), { name: 'x' }).value as { name: string }).name).toContain(
        '👋',
      );
    });

    it('should apply number presets', () => {
      const preset = (preset: 'zero' | 'negative' | 'huge' | 'custom', custom?: number) => [
        { id: '1', op: { type: 'numberPreset' as const, path: ['count'], preset, custom } },
      ];

      expect(applyQueryDevtoolsOverrides(preset('zero'), { count: 5 }).value).toEqual({ count: 0 });
      expect(applyQueryDevtoolsOverrides(preset('negative'), { count: 5 }).value).toEqual({ count: -1 });
      expect(applyQueryDevtoolsOverrides(preset('custom', 7), { count: 5 }).value).toEqual({ count: 7 });
    });

    it('should apply an invalid date preset as a deliberately unparseable string', () => {
      const entries = [{ id: '1', op: { type: 'datePreset' as const, path: ['at'], preset: 'invalid' as const } }];

      const { value } = applyQueryDevtoolsOverrides(entries, { at: '2024-01-01T00:00:00.000Z' });

      expect(Number.isNaN(Date.parse((value as { at: string }).at))).toBe(true);
    });

    it('should duplicate one array item next to itself, remapping its id and any sibling-unique field', () => {
      const entries = [{ id: '1', op: { type: 'duplicateArrayItem' as const, path: ['items'], index: 0 } }];
      const raw = {
        items: [
          { id: 1, name: 'a' },
          { id: 2, name: 'b' },
        ],
      };

      const { value } = applyQueryDevtoolsOverrides(entries, raw);

      expect((value as typeof raw).items).toEqual([
        { id: 1, name: 'a' },
        { id: 3, name: 'a-copy-1' },
        { id: 2, name: 'b' },
      ]);
    });

    it('should flag duplicateArrayItem stale for an out-of-range index', () => {
      const entries = [{ id: '1', op: { type: 'duplicateArrayItem' as const, path: ['items'], index: 5 } }];

      expect(applyQueryDevtoolsOverrides(entries, { items: [1] }).staleIds).toEqual(['1']);
    });

    it('should double a whole array, remapping ids across all copies without collisions', () => {
      const entries = [{ id: '1', op: { type: 'duplicateArray' as const, path: ['items'] } }];
      const raw = { items: [{ id: 1 }, { id: 2 }] };

      const { value } = applyQueryDevtoolsOverrides(entries, raw);
      const items = (value as typeof raw).items;

      expect(items).toHaveLength(4);
      expect(new Set(items.map((item) => item.id)).size).toBe(4);
    });

    it('should shrink a gg-like pagination shape and keep the counters consistent', () => {
      const entries = [
        { id: '1', op: { type: 'paginationResize' as const, path: [], mode: 'shrink' as const, amount: 1 } },
      ];
      const raw = {
        items: [{ id: 1 }, { id: 2 }],
        totalHits: 2,
        currentPage: 1,
        totalPageCount: 1,
        itemsPerPage: 10,
      };

      const { value } = applyQueryDevtoolsOverrides(entries, raw);

      expect(value).toMatchObject({ items: [{ id: 1 }], totalHits: 1 });
    });

    it('should extend a dyn-like pagination shape by duplicating items with fresh ids', () => {
      const entries = [
        { id: '1', op: { type: 'paginationResize' as const, path: [], mode: 'extend' as const, amount: 2 } },
      ];
      const raw = { items: [{ id: 1 }], totalHits: 1, currentPage: 1, totalPages: 1, limit: 10 };

      const { value } = applyQueryDevtoolsOverrides(entries, raw) as { value: typeof raw };

      expect(value.items).toHaveLength(3);
      expect(value.totalHits).toBe(3);
      expect(new Set(value.items.map((item) => item.id)).size).toBe(3);
    });

    it('should flag paginationResize stale when the shape does not structurally match', () => {
      const entries = [
        { id: '1', op: { type: 'paginationResize' as const, path: [], mode: 'shrink' as const, amount: 1 } },
      ];

      expect(applyQueryDevtoolsOverrides(entries, { items: [1] }).staleIds).toEqual(['1']);
    });
  });

  describe('detectPaginationShape', () => {
    it('should detect every known shape', () => {
      expect(
        detectPaginationShape({ items: [], totalHits: 0, currentPage: 1, totalPageCount: 1, itemsPerPage: 10 }),
      ).toBe('gg-like');
      expect(detectPaginationShape({ items: [], totalHits: 0, currentPage: 1, totalPages: 1, limit: 10 })).toBe(
        'dyn-like',
      );
      expect(detectPaginationShape({ items: [], totalPages: 1, totalHits: 0, currentPage: 1, itemsPerPage: 10 })).toBe(
        'normalized',
      );
      expect(detectPaginationShape({ items: [], limit: 10, skip: 0, total: 0 })).toBe('contentful-gql-like');
    });

    it('should return null for a plain object with an items array but no recognizable counters', () => {
      expect(detectPaginationShape({ items: [], label: 'x' })).toBeNull();
    });

    it('should return null when there is no items array at all', () => {
      expect(detectPaginationShape({ totalHits: 0 })).toBeNull();
      expect(detectPaginationShape(null)).toBeNull();
      expect(detectPaginationShape([1, 2, 3])).toBeNull();
    });
  });
});
