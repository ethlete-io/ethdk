import { invalidBaseRouteError, invalidRouteError, pathParamsMissingInRouteFunctionError } from '../logger';
import {
  buildQueryArrayString,
  buildQueryString,
  buildRoute,
  filterInvalidParams,
  isParamValid,
  isRequestError,
} from './request.util';

describe('isRequestError', () => {
  it('should be falsy', () => {
    expect(isRequestError('foo')).toBeFalsy();
  });

  it('should by truthy', () => {
    expect(isRequestError({ status: 200, statusText: 'Error', url: '...' })).toBeTruthy();
  });
});

describe('buildQueryString', () => {
  const uriBrackets = encodeURIComponent('[]');

  it('should work', () => {
    expect(buildQueryString({ foo: 123 })).toEqual('foo=123');
  });

  it('should work', () => {
    expect(buildQueryString({ foo: 123, bar: 'string' })).toEqual('foo=123&bar=string');
  });

  it('should return null if all params are invalid', () => {
    expect(
      buildQueryString({
        foo1: '',
        foo2: '   ',
        foo3: undefined,
        bar: null,
        stuff: [null, undefined, null],
        baz: NaN,
      }),
    ).toEqual(null);
  });

  it('should work with valid but falsy params', () => {
    expect(
      buildQueryString({
        bar: 0,
        stuff: -0,
      }),
    ).toEqual('bar=0&stuff=0');
  });

  it('should filter out invalid params', () => {
    expect(buildQueryString({ foo: undefined, bar: true })).toEqual('bar=true');
  });

  it('should work with array, valid and invalid params', () => {
    expect(
      buildQueryString({
        foo: ['abc', 'def', null, undefined],
        bar: true,
        something: null,
        other: undefined,
      }),
    ).toEqual(`foo${uriBrackets}=abc&foo${uriBrackets}=def&bar=true`);
  });

  it('should work with array params and normal params', () => {
    expect(buildQueryArrayString('key', ['abc', 'def'])).toEqual(`key${uriBrackets}=abc&key${uriBrackets}=def`);
  });
});

describe('filterInvalidParams', () => {
  it('should work', () => {
    expect(
      filterInvalidParams({
        a: 0,
        b: null,
        c: undefined,
        arr: [true, false, '  ', undefined, null],
      }),
    ).toEqual({
      a: 0,
      arr: [true, false],
    });
  });
});

describe('isParamValid', () => {
  it('should be falsy', () => {
    expect(isParamValid('')).toBe(false);
    expect(isParamValid('   ')).toBe(false);
    expect(isParamValid(undefined)).toBe(false);
    expect(isParamValid(null)).toBe(false);
    expect(isParamValid(NaN)).toBe(false);
  });

  it('should be truthy', () => {
    expect(isParamValid('abc')).toBe(true);
    expect(isParamValid(0)).toBe(true);
    expect(isParamValid(123)).toBe(true);
    expect(isParamValid(true)).toBe(true);
    expect(isParamValid(false)).toBe(true);
  });
});

describe('buildRoute', () => {
  it('should work without params', () => {
    expect(
      buildRoute({
        base: 'https://example.com',
        route: '/foo',
      }),
    ).toBe('https://example.com/foo');
  });

  it('should work with path params', () => {
    expect(
      buildRoute({
        base: 'https://example.com',
        route: (args) => '/foo/' + args['id'],
        pathParams: { id: 1 },
      }),
    ).toBe('https://example.com/foo/1');
  });

  it('should work with query params', () => {
    expect(
      buildRoute({
        base: 'https://example.com',
        route: '/foo',
        queryParams: { id: 1 },
      }),
    ).toBe('https://example.com/foo?id=1');
  });

  it('should work with query and path params', () => {
    expect(
      buildRoute({
        base: 'https://example.com',
        route: (args) => '/foo/' + args['id'],
        pathParams: { id: 1 },
        queryParams: { filter: true },
      }),
    ).toBe('https://example.com/foo/1?filter=true');
  });

  it('should fail with a route function without provided path params', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn = (args: any) => '/foo/' + args.id;

    expect(() => {
      buildRoute({
        base: 'https://example.com',
        route: (args) => '/foo/' + args['id'],
      });
    }).toThrow(pathParamsMissingInRouteFunctionError(fn({})));
  });

  it('should fail with  base route ending with a slash', () => {
    expect(() => {
      buildRoute({
        base: 'https://example.com/',
        route: '/foo',
      });
    }).toThrow(invalidBaseRouteError('https://example.com/'));
  });

  it('should fail with route missing a slash at the start', () => {
    expect(() => {
      buildRoute({
        base: 'https://example.com',
        route: 'foo',
      });
    }).toThrowError(invalidRouteError('foo'));
  });
});
