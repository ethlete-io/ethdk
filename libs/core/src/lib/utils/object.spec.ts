import { getObjectProperty, isArray, isObject } from './object';

describe('getObjectProperty', () => {
  it('should return the value of a property', () => {
    const obj = {
      a: {
        b: {
          c: 'd',
          e: ['f'],
          g: [{ h: 'i' }],
          h: [{ i: ['j'] }],
        },
      },
    };

    expect(getObjectProperty(obj, 'a.b.c')).toEqual('d');
    expect(getObjectProperty(obj, 'a.b.e[0]')).toEqual('f');
    expect(getObjectProperty(obj, 'a.b.g[0].h')).toEqual('i');
    expect(getObjectProperty(obj, 'a.b.h[0].i[0]')).toEqual('j');
  });

  it('should follow chained array indexes', () => {
    const obj = { a: [[1, 2], [3]], b: { c: [[{ d: 'e' }]] } };

    expect(getObjectProperty(obj, 'a[0][1]')).toBe(2);
    expect(getObjectProperty(obj, 'a[1][0]')).toBe(3);
    expect(getObjectProperty(obj, 'b.c[0][0].d')).toBe('e');
    expect(getObjectProperty(obj, 'a[0][5]')).toBeUndefined();
    expect(getObjectProperty(obj, 'a[0][1][0]')).toBeUndefined();
  });

  it('should return undefined if the property does not exist', () => {
    const obj = {
      a: {
        b: {
          c: 'd',
          e: ['f'],
          g: [{ h: 'i' }],
          h: [{ i: ['j'] }],
        },
      },
    };

    expect(getObjectProperty(obj, 'a.b.h[0].i[1]')).toBeUndefined();
    expect(getObjectProperty(obj, 'a.b.i')).toBeUndefined();
  });

  it('should return undefined if the path is invalid', () => {
    const obj = {
      a: {
        b: {
          c: 'd',
          e: ['f'],
          g: [{ h: 'i' }],
          h: [{ i: ['j'] }],
        },
      },
    };

    expect(getObjectProperty(obj, 'a.b.c.d')).toBeUndefined();
    expect(getObjectProperty(obj, 'a.b.e[1]')).toBeUndefined();
    expect(getObjectProperty(obj, 'a.b.e[x')).toBeUndefined();
    expect(getObjectProperty(obj, 'a.b.g0].i')).toBeUndefined();
  });
});

describe('isObject', () => {
  it('should return true if the value is an object', () => {
    expect(isObject({})).toBe(true);
    expect(isObject(new Date())).toBe(true);
    expect(isObject(new RegExp(''))).toBe(true);
  });

  it('should return false if the value is not an object', () => {
    expect(isObject(null)).toBe(false);
    expect(isObject(undefined)).toBe(false);
    expect(isObject('')).toBe(false);
    expect(isObject(0)).toBe(false);
    expect(isObject(true)).toBe(false);
    expect(isObject([])).toBe(false);
  });
});

describe('isArray', () => {
  it('should return true if the value is an array', () => {
    expect(isArray([])).toBe(true);
    expect(isArray([1, 2, 3])).toBe(true);
  });

  it('should return false if the value is not an array', () => {
    expect(isArray(null)).toBe(false);
    expect(isArray(undefined)).toBe(false);
    expect(isArray('')).toBe(false);
    expect(isArray(0)).toBe(false);
    expect(isArray(true)).toBe(false);
    expect(isArray({})).toBe(false);
  });
});
