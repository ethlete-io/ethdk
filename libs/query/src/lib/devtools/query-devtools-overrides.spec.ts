import {
  applyQueryDevtoolsOverrides,
  collectLeafPaths,
  createQueryDevtoolsOverrides,
  detectPaginationShape,
  generateQueryDevtoolsNumberPreset,
  generateQueryDevtoolsSampleNumber,
  generateQueryDevtoolsStringPreset,
  hasQueryDevtoolsOverridesAtPath,
  isDateShapedLeaf,
  OverrideOp,
  smartDuplicateArrayItem,
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

    it('should not store a reset op, and instead disarm ops already at its path', () => {
      const recorder = createQueryDevtoolsOverrides();

      recorder.arm({ type: 'set', path: ['a', 'b'], value: 1 });
      recorder.arm({ type: 'set', path: ['a', 'c'], value: 2 });
      recorder.arm({ type: 'reset', path: ['a', 'b'] });

      expect(recorder.list().map((entry) => entry.op.path)).toEqual([['a', 'c']]);
    });

    it('should disarm ops below the reset path too, so resetting a container undoes a recursive fill', () => {
      const recorder = createQueryDevtoolsOverrides();

      recorder.arm({ type: 'set', path: ['a', 'b'], value: 1 });
      recorder.arm({ type: 'set', path: ['a'], value: 2 });
      recorder.arm({ type: 'set', path: ['ab'], value: 3 });
      recorder.arm({ type: 'reset', path: ['a'] });

      expect(recorder.list().map((entry) => entry.op.path)).toEqual([['ab']]);
    });

    it('should apply armed ops to a raw response', () => {
      const recorder = createQueryDevtoolsOverrides();

      recorder.arm({ type: 'set', path: ['name'], value: 'Ada' });

      expect(recorder.apply({ name: 'Grace' })).toEqual({ name: 'Ada' });
    });
  });

  describe('hasQueryDevtoolsOverridesAtPath', () => {
    const entries = [{ id: '1', op: { type: 'set' as const, path: ['user', 'name'], value: 'Ada' } }];

    it('should report an op armed at the path itself and at any path above it', () => {
      expect(hasQueryDevtoolsOverridesAtPath(entries, ['user', 'name'])).toBe(true);
      expect(hasQueryDevtoolsOverridesAtPath(entries, ['user'])).toBe(true);
      expect(hasQueryDevtoolsOverridesAtPath(entries, [])).toBe(true);
    });

    it('should not report a sibling, a deeper path, or a key the path is only a prefix of', () => {
      expect(hasQueryDevtoolsOverridesAtPath(entries, ['user', 'age'])).toBe(false);
      expect(hasQueryDevtoolsOverridesAtPath(entries, ['user', 'name', 'first'])).toBe(false);
      expect(hasQueryDevtoolsOverridesAtPath(entries, ['users'])).toBe(false);
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
      const preset = (preset: 'short' | 'long' | 'longWord' | 'unicode' | 'custom', custom?: string) => [
        { id: '1', op: { type: 'stringPreset' as const, path: ['name'], preset, custom } },
      ];

      expect(applyQueryDevtoolsOverrides(preset('short'), { name: 'x' }).value).toEqual({ name: 'Ab' });
      expect(applyQueryDevtoolsOverrides(preset('custom', 'hi'), { name: 'x' }).value).toEqual({ name: 'hi' });
      expect(applyQueryDevtoolsOverrides(preset('custom'), { name: 'x' }).value).toEqual({ name: '' });
      expect((applyQueryDevtoolsOverrides(preset('unicode'), { name: 'x' }).value as { name: string }).name).toContain(
        '👋',
      );
      expect(
        (applyQueryDevtoolsOverrides(preset('longWord'), { name: 'x' }).value as { name: string }).name,
      ).not.toContain(' ');
    });

    it('should replay a stored custom value over the preset label it was generated under', () => {
      const entries = [
        { id: '1', op: { type: 'stringPreset' as const, path: ['name'], preset: 'short' as const, custom: 'Nova' } },
        { id: '2', op: { type: 'numberPreset' as const, path: ['count'], preset: 'huge' as const, custom: 123456 } },
      ];

      expect(applyQueryDevtoolsOverrides(entries, { name: 'x', count: 5 }).value).toEqual({
        name: 'Nova',
        count: 123456,
      });
    });

    it('should apply number presets', () => {
      const preset = (preset: 'zero' | 'negative' | 'huge' | 'custom', custom?: number) => [
        { id: '1', op: { type: 'numberPreset' as const, path: ['count'], preset, custom } },
      ];

      expect(applyQueryDevtoolsOverrides(preset('zero'), { count: 5 }).value).toEqual({ count: 0 });
      expect(applyQueryDevtoolsOverrides(preset('negative'), { count: 5 }).value).toEqual({ count: -1 });
      expect(applyQueryDevtoolsOverrides(preset('custom', 7), { count: 5 }).value).toEqual({ count: 7 });
    });

    it('should generate varied preset samples that stay inside their preset contract', () => {
      for (let i = 0; i < 20; i++) {
        expect(generateQueryDevtoolsStringPreset('short').length).toBeLessThanOrEqual(10);
        expect(generateQueryDevtoolsStringPreset('long').length).toBeGreaterThanOrEqual(60);
        expect(generateQueryDevtoolsStringPreset('longWord')).not.toMatch(/\s/);
        expect(generateQueryDevtoolsStringPreset('longWord').length).toBeGreaterThanOrEqual(40);

        expect(generateQueryDevtoolsNumberPreset('zero')).toBe(0);
        expect(generateQueryDevtoolsNumberPreset('negative')).toBeLessThan(0);
        expect(Number.isSafeInteger(generateQueryDevtoolsNumberPreset('negative'))).toBe(true);
        expect(generateQueryDevtoolsNumberPreset('huge')).toBeGreaterThanOrEqual(10 ** 9);
        expect(Number.isSafeInteger(generateQueryDevtoolsNumberPreset('huge'))).toBe(true);
      }

      const samples = new Set(Array.from({ length: 20 }, () => generateQueryDevtoolsStringPreset('long')));
      expect(samples.size).toBeGreaterThan(1);
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

    it('should paste a new array item at the end when no index is given', () => {
      const entries = [{ id: '1', op: { type: 'pasteArrayItem' as const, path: ['items'], value: { id: 9 } } }];

      const { value, staleIds } = applyQueryDevtoolsOverrides(entries, { items: [{ id: 1 }] });

      expect((value as { items: unknown[] }).items).toEqual([{ id: 1 }, { id: 9 }]);
      expect(staleIds).toEqual([]);
    });

    it('should splice a pasted array item in at its index, shifting the tail', () => {
      const entries = [{ id: '1', op: { type: 'pasteArrayItem' as const, path: ['items'], value: 'x', index: 1 } }];

      const { value } = applyQueryDevtoolsOverrides(entries, { items: ['a', 'b', 'c'] });

      expect((value as { items: unknown[] }).items).toEqual(['a', 'x', 'b', 'c']);
    });

    it('should clamp a pasted array item to the end rather than leaving a hole past it', () => {
      const entries = [{ id: '1', op: { type: 'pasteArrayItem' as const, path: ['items'], value: 'x', index: 7 } }];

      const { value } = applyQueryDevtoolsOverrides(entries, { items: ['a'] });

      expect((value as { items: unknown[] }).items).toEqual(['a', 'x']);
    });

    it('should flag pasteArrayItem stale when its path is not an array', () => {
      const entries = [{ id: '1', op: { type: 'pasteArrayItem' as const, path: ['items'], value: 1 } }];

      expect(applyQueryDevtoolsOverrides(entries, { items: {} }).staleIds).toEqual(['1']);
    });

    it('should delete an object key outright, so the field reads as absent rather than empty', () => {
      const entries = [{ id: '1', op: { type: 'deleteAt' as const, path: ['title'] } }];

      const { value } = applyQueryDevtoolsOverrides(entries, { id: 1, title: 'a' });

      expect(value).toEqual({ id: 1 });
      expect('title' in (value as object)).toBe(false);
    });

    it('should splice an array element out rather than leaving a hole where it was', () => {
      const entries = [{ id: '1', op: { type: 'deleteAt' as const, path: ['items', 1] } }];

      const { value } = applyQueryDevtoolsOverrides(entries, { items: ['a', 'b', 'c'] });

      expect((value as { items: unknown[] }).items).toEqual(['a', 'c']);
    });

    it('should leave sibling branches untouched when deleting a nested key', () => {
      const raw = { keep: { deep: 1 }, drop: { gone: 2 } };
      const entries = [{ id: '1', op: { type: 'deleteAt' as const, path: ['drop', 'gone'] } }];

      const { value } = applyQueryDevtoolsOverrides(entries, raw);

      expect(value).toEqual({ keep: { deep: 1 }, drop: {} });
      expect((value as typeof raw).keep).toBe(raw.keep);
    });

    it('should flag deleteAt stale for a key that is not there', () => {
      const entries = [{ id: '1', op: { type: 'deleteAt' as const, path: ['nope'] } }];

      expect(applyQueryDevtoolsOverrides(entries, { id: 1 }).staleIds).toEqual(['1']);
    });

    it('should flag deleteAt stale at the response root, which has no parent to leave', () => {
      const entries = [{ id: '1', op: { type: 'deleteAt' as const, path: [] } }];

      expect(applyQueryDevtoolsOverrides(entries, { id: 1 }).staleIds).toEqual(['1']);
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

  describe('applyQueryDevtoolsOverrides edge cases', () => {
    const apply = (raw: unknown, ...ops: OverrideOp[]) =>
      applyQueryDevtoolsOverrides(
        ops.map((op, index) => ({ id: String(index + 1), op })),
        raw,
      );

    it('should flag an op stale when a container along its path is a primitive', () => {
      expect(apply({ a: 5 }, { type: 'set', path: ['a', 'b'], value: 1 }).staleIds).toEqual(['1']);
      expect(apply({ a: 5 }, { type: 'set', path: ['a', 'b', 'c'], value: 1 }).staleIds).toEqual(['1']);
      expect(apply({ a: null }, { type: 'set', path: ['a', 'b'], value: 1 }).staleIds).toEqual(['1']);
    });

    it('should write through an array on the path, keeping the untouched elements by reference', () => {
      const first = { name: 'a' };
      const raw = { list: [first, { name: 'b' }] };

      const { value, staleIds } = apply(raw, { type: 'set', path: ['list', 1, 'name'], value: 'x' });
      const list = (value as typeof raw).list;

      expect(staleIds).toEqual([]);
      expect(list).toEqual([{ name: 'a' }, { name: 'x' }]);
      expect(list[0]).toBe(first);
      expect(raw.list[1]).toEqual({ name: 'b' });
    });

    it('should delete a key nested below an array element', () => {
      const raw = { list: [{ name: 'a', id: 1 }, { name: 'b' }] };

      const { value } = apply(raw, { type: 'deleteAt', path: ['list', 0, 'name'] });

      expect(value).toEqual({ list: [{ id: 1 }, { name: 'b' }] });
    });

    it('should neither store nor flag a reset op replayed through the entry list', () => {
      const { value, staleIds } = apply(
        { a: 1 },
        { type: 'reset', path: ['a'] },
        { type: 'set', path: ['a'], value: 2 },
      );

      expect(value).toEqual({ a: 2 });
      expect(staleIds).toEqual([]);
    });

    it('should flag a preset stale for a key that is not there, rather than adding it', () => {
      const raw = { present: 'x' };
      const { value, staleIds } = apply(
        raw,
        { type: 'stringPreset', path: ['missing'], preset: 'short' },
        { type: 'numberPreset', path: ['missing'], preset: 'zero' },
        { type: 'datePreset', path: ['missing'], preset: 'now' },
      );

      expect(staleIds).toEqual(['1', '2', '3']);
      expect(value).toBe(raw);
    });

    it('should fall back to 0 for a custom number preset without a value', () => {
      expect(apply({ n: 7 }, { type: 'numberPreset', path: ['n'], preset: 'custom' }).value).toEqual({ n: 0 });
    });

    it('should write every date preset relative to the current time', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-10T12:00:00.000Z'));

      try {
        const at = (preset: 'now' | 'plusDay' | 'minusDay' | 'farFuture' | 'farPast') =>
          (apply({ d: 'x' }, { type: 'datePreset', path: ['d'], preset }).value as { d: string }).d;

        expect(at('now')).toBe('2026-03-10T12:00:00.000Z');
        expect(at('plusDay')).toBe('2026-03-11T12:00:00.000Z');
        expect(at('minusDay')).toBe('2026-03-09T12:00:00.000Z');
        expect(at('farFuture')).toBe('2099-01-01T00:00:00.000Z');
        expect(at('farPast')).toBe('1970-01-01T00:00:00.000Z');
      } finally {
        vi.useRealTimers();
      }
    });

    it('should flag duplicateArray stale when its path is not an array', () => {
      expect(apply({ a: { b: 1 } }, { type: 'duplicateArray', path: ['a'] }).staleIds).toEqual(['1']);
    });

    it('should duplicate a primitive array element as it is', () => {
      expect(apply({ list: [1, 2] }, { type: 'duplicateArrayItem', path: ['list'], index: 0 }).value).toEqual({
        list: [1, 1, 2],
      });
    });

    it('should leave the items and counters alone when extending an empty page', () => {
      const raw = { items: [], totalHits: 0, currentPage: 1, totalPageCount: 1, itemsPerPage: 10 };

      expect(apply(raw, { type: 'paginationResize', path: [], mode: 'extend', amount: 3 }).value).toEqual(raw);
    });

    it('should keep the counters of a normalized page consistent when extending it', () => {
      const raw = { items: [{ id: 1 }], totalHits: 1, currentPage: 1, totalPages: 1, itemsPerPage: 1 };

      const value = apply(raw, { type: 'paginationResize', path: [], mode: 'extend', amount: 2 }).value;

      expect(value).toMatchObject({ totalHits: 3, totalPages: 3 });
      expect((value as typeof raw).items.map((item) => item.id)).toEqual([1, 2, 3]);
    });

    it('should keep the total of a contentful-like page consistent when shrinking it', () => {
      const raw = { items: [{ id: 1 }, { id: 2 }], limit: 10, skip: 0, total: 2 };

      expect(apply(raw, { type: 'paginationResize', path: [], mode: 'shrink', amount: 1 }).value).toEqual({
        items: [{ id: 1 }],
        limit: 10,
        skip: 0,
        total: 1,
      });
    });

    it('should treat a zero page size as one when recomputing the page count', () => {
      const gg = { items: [{ id: 1 }, { id: 2 }], totalHits: 2, currentPage: 1, totalPageCount: 1, itemsPerPage: 0 };
      const dyn = { items: [{ id: 1 }, { id: 2 }], totalHits: 2, currentPage: 1, totalPages: 1, limit: 0 };
      const normalized = {
        items: [{ id: 1 }, { id: 2 }],
        totalHits: 2,
        currentPage: 1,
        totalPages: 1,
        itemsPerPage: 0,
      };
      const shrink: OverrideOp = { type: 'paginationResize', path: [], mode: 'shrink', amount: 1 };

      expect(apply(gg, shrink).value).toMatchObject({ totalHits: 1, totalPageCount: 1 });
      expect(apply(dyn, shrink).value).toMatchObject({ totalHits: 1, totalPages: 1 });
      expect(apply(normalized, shrink).value).toMatchObject({ totalHits: 1, totalPages: 1 });
    });
  });

  describe('smartDuplicateArrayItem', () => {
    it('should remap identity keys and sibling-unique fields, and keep shared or non-scalar ones', () => {
      const meta = { tags: ['x'] };
      const siblings = [
        { id: 1, code: 'a', group: 'x', meta },
        { id: 2, code: 'b', group: 'x', meta: { tags: [] } },
        { label: 'no fields in common' },
      ];

      const copy = smartDuplicateArrayItem(siblings[0], siblings) as (typeof siblings)[0];

      expect(copy).toEqual({ id: 3, code: 'a-copy-1', group: 'x', meta });
      expect(copy.meta).toBe(meta);
    });

    it('should pick the next free string suffix', () => {
      const siblings = [{ key: 'row' }, { key: 'row-copy-1' }];

      expect(smartDuplicateArrayItem(siblings[0], siblings)).toEqual({ key: 'row-copy-2' });
    });

    it('should start a numeric id at 1 when no sibling holds a number for it', () => {
      expect(smartDuplicateArrayItem({ userId: 5 }, [])).toEqual({ userId: 1 });
    });

    it('should return primitives and arrays unchanged', () => {
      const array = [1];

      expect(smartDuplicateArrayItem(3, [3])).toBe(3);
      expect(smartDuplicateArrayItem(null, [])).toBeNull();
      expect(smartDuplicateArrayItem(array, [array])).toBe(array);
    });
  });

  describe('isDateShapedLeaf', () => {
    it('should accept a parseable value under a date-shaped key', () => {
      expect(isDateShapedLeaf('createdAt', 'March 7, 2024')).toBe(true);
      expect(isDateShapedLeaf('birthDate', '2024-03-07')).toBe(true);
      expect(isDateShapedLeaf('lastTimestamp', '2024-03-07T10:00:00Z')).toBe(true);
    });

    it('should accept an ISO date under any key, and reject anything else', () => {
      expect(isDateShapedLeaf('title', '2024-03-07T10:00:00.123+02:00')).toBe(true);
      expect(isDateShapedLeaf(0, '2024-03-07')).toBe(true);
      expect(isDateShapedLeaf(null, '2024-03-07 10:00')).toBe(true);
      expect(isDateShapedLeaf('title', 'March 7, 2024')).toBe(false);
      expect(isDateShapedLeaf('createdAt', 'soon')).toBe(false);
      expect(isDateShapedLeaf('createdAt', 1709805600000)).toBe(false);
    });
  });

  describe('collectLeafPaths', () => {
    const value = { name: 'a', count: 1, flags: [true, false], nested: { label: 'b', items: [{ title: 'c', n: 2 }] } };

    it('should collect every leaf of the requested kind, through objects and arrays', () => {
      expect(collectLeafPaths(value, 'string')).toEqual([
        ['name'],
        ['nested', 'label'],
        ['nested', 'items', 0, 'title'],
      ]);
      expect(collectLeafPaths(value, 'number')).toEqual([['count'], ['nested', 'items', 0, 'n']]);
      expect(collectLeafPaths(value, 'boolean')).toEqual([
        ['flags', 0],
        ['flags', 1],
      ]);
    });

    it('should return the root path for a matching primitive and nothing for null', () => {
      expect(collectLeafPaths('x', 'string')).toEqual([[]]);
      expect(collectLeafPaths(null, 'string')).toEqual([]);
    });
  });

  describe('generateQueryDevtoolsSampleNumber', () => {
    it('should default to an integer from 1 up to 1000 when no bounds are declared', () => {
      for (let i = 0; i < 50; i++) {
        const value = generateQueryDevtoolsSampleNumber({ min: null, max: null, fractional: false });

        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(1000);
      }
    });

    it('should stay inside declared fractional bounds with at most two decimals', () => {
      for (let i = 0; i < 50; i++) {
        const value = generateQueryDevtoolsSampleNumber({ min: 0, max: 10, fractional: true });

        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(10);
        expect(Math.round(value * 100)).toBeCloseTo(value * 100, 6);
      }
    });

    it('should return the only value a collapsed range allows', () => {
      expect(generateQueryDevtoolsSampleNumber({ min: 5, max: 5, fractional: true })).toBe(5);
      expect(generateQueryDevtoolsSampleNumber({ min: 5, max: 2, fractional: false })).toBe(5);
    });
  });
});
