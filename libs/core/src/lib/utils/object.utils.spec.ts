import { getObjectProperty, isArray, isObject } from './object.utils';

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
    expect(getObjectProperty(obj, 'a.b.e[1')).toBeUndefined();
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
