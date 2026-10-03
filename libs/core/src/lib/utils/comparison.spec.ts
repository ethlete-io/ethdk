import { clone, equal } from './comparison';

describe('comparison utilities', () => {
  it('compares plain objects with different object prototypes', () => {
    const dictionary = Object.assign(Object.create(null) as Record<string, number>, { value: 1 });

    expect(equal(dictionary, { value: 1 })).toBe(true);
    expect(equal({ value: 1 }, dictionary)).toBe(true);
  });

  it('clones circular values', () => {
    const value: { label: string; self?: unknown } = { label: 'root' };
    value.self = value;

    const cloned = clone(value);

    expect(cloned).not.toBe(value);
    expect(cloned.self).toBe(cloned);
  });

  it('compares Dates by time rather than constructor identity', () => {
    expect(equal(new Date(0), new Date(999))).toBe(false);
    expect(equal(new Date(999), new Date(999))).toBe(true);
  });

  it('compares Dates by time under a faked global Date constructor', () => {
    vi.useFakeTimers({ toFake: ['Date'] });

    expect(equal(new Date(0), new Date(999))).toBe(false);
    expect(equal(new Date(999), new Date(999))).toBe(true);

    vi.useRealTimers();
  });
});

describe('equal edge values', () => {
  it('treats NaN as equal to NaN and 0 as equal to -0', () => {
    expect(equal(NaN, NaN)).toBe(true);
    expect(equal(0, -0)).toBe(true);
    expect(equal(NaN, 0)).toBe(false);
  });

  it('distinguishes empty containers of different kinds', () => {
    expect(equal([], {})).toBe(false);
    expect(equal({}, [])).toBe(false);
    expect(equal(new Map(), new Set())).toBe(false);
    expect(equal([], [])).toBe(true);
    expect(equal({}, {})).toBe(true);
  });

  it('distinguishes null, undefined and missing keys', () => {
    expect(equal(null, undefined)).toBe(false);
    expect(equal({ a: undefined }, {})).toBe(false);
    expect(equal({}, { a: undefined })).toBe(false);
    expect(equal({ a: undefined }, { b: undefined })).toBe(false);
  });

  it('distinguishes Maps whose keys differ but whose values are undefined', () => {
    expect(equal(new Map([['a', undefined]]), new Map([['b', undefined]]))).toBe(false);
  });

  it('distinguishes Maps whose object keys differ but whose values are undefined', () => {
    expect(equal(new Map([[{ id: 1 }, undefined]]), new Map([[{ id: 2 }, undefined]]))).toBe(false);
  });

  it('compares Maps and Sets with structurally equal object keys', () => {
    expect(equal(new Map([[{ id: 1 }, 'x']]), new Map([[{ id: 1 }, 'x']]))).toBe(true);
    expect(equal(new Set([{ id: 1 }]), new Set([{ id: 1 }]))).toBe(true);
    expect(equal(new Set([{ id: 1 }]), new Set([{ id: 2 }]))).toBe(false);
  });

  it('compares a Date with a non-Date as unequal', () => {
    expect(equal(new Date(0), 0)).toBe(false);
    expect(equal({}, new Date(0))).toBe(false);
    expect(equal(new Date(NaN), new Date(NaN))).toBe(false);
  });

  it('compares typed arrays and buffers by content', () => {
    expect(equal(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(equal(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
    expect(equal(new Uint8Array([1]).buffer, new Uint8Array([1]).buffer)).toBe(true);
  });

  it('compares RegExps by source and flags', () => {
    expect(equal(/a/g, /a/g)).toBe(true);
    expect(equal(/a/g, /a/i)).toBe(false);
  });
});

describe('clone edge values', () => {
  it('returns primitives as they are', () => {
    expect(clone(NaN)).toBeNaN();
    expect(Object.is(clone(-0), -0)).toBe(true);
    expect(clone(null)).toBeNull();
    expect(clone(undefined)).toBeUndefined();
  });

  it('copies Dates, Maps and Sets into new instances', () => {
    const date = new Date(5);
    const map = new Map([[{ id: 1 }, new Date(1)]]);
    const set = new Set([{ id: 1 }]);
    const cloned = clone({ date, map, set });

    expect(cloned.date).not.toBe(date);
    expect(cloned.date.getTime()).toBe(5);
    expect(cloned.map).not.toBe(map);
    expect(equal(cloned.map, map)).toBe(true);
    expect(cloned.set).not.toBe(set);
    expect(equal(cloned.set, set)).toBe(true);
  });

  it('keeps circular references inside Maps, Sets and arrays', () => {
    const list: unknown[] = [];
    list.push(list);
    const map = new Map<string, unknown>();
    map.set('self', map);
    const set = new Set<unknown>();
    set.add(set);

    const clonedList = clone(list);
    const clonedMap = clone(map);
    const clonedSet = clone(set);

    expect(clonedList[0]).toBe(clonedList);
    expect(clonedMap.get('self')).toBe(clonedMap);
    expect([...clonedSet][0]).toBe(clonedSet);
  });

  it('keeps a shared reference shared', () => {
    const shared = { id: 1 };
    const cloned = clone({ a: shared, b: shared });

    expect(cloned.a).not.toBe(shared);
    expect(cloned.a).toBe(cloned.b);
  });

  it('copies sparse arrays and class instances', () => {
    class Point {
      constructor(public x: number) {}
    }
    const cloned = clone({ p: new Point(1), sparse: Object.assign(new Array<number>(3), { 0: 1, 2: 3 }) });

    expect(cloned.p).toBeInstanceOf(Point);
    expect(cloned.p.x).toBe(1);
    expect(cloned.sparse).toHaveLength(3);
    expect(1 in cloned.sparse).toBe(false);
  });
});
