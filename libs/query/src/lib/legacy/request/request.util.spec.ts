import { invalidBaseRouteError, invalidRouteError, pathParamsMissingInRouteFunctionError } from '../logger';
import { V2RouteString } from '../query';
import { buildQueryString, buildRoute, isRequestError } from './request.util';

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
  const dot = encodeURIComponent('.');
  const uriBracketsZero = encodeURIComponent('[0]');
  const brOpen = encodeURIComponent('[');
  const brClose = encodeURIComponent(']');
  const uriBracketsOne = encodeURIComponent('[1]');
  const uriBracketsTwo = encodeURIComponent('[2]');

  it('should work with a single param', () => {
    expect(buildQueryString({ foo: 123 })).toEqual('foo=123');
  });

  it('should work with multiple params', () => {
    expect(buildQueryString({ foo: 123, bar: 'string' })).toEqual('foo=123&bar=string');
  });

  it('should work with valid but falsy params', () => {
    expect(
      buildQueryString({
        bar: 0,
        stuff: -0,
      }),
    ).toEqual('bar=0&stuff=0');
  });

  it('should work with arrays', () => {
    expect(
      buildQueryString({
        foo: ['abc', 'def'],
        bar: true,
      }),
    ).toEqual(`foo${uriBrackets}=abc&foo${uriBrackets}=def&bar=true`);
  });

  it('should filter out invalid values using default config', () => {
    expect(
      buildQueryString({
        foo: ['abc', 'def', null, undefined, NaN],
        bar: true,
        baz: Infinity,
        bi: '   ',
      }),
    ).toEqual(`foo${uriBrackets}=abc&foo${uriBrackets}=def&bar=true`);
  });

  it('should use correct filtered array indexes', () => {
    expect(
      buildQueryString(
        {
          foo: ['abc', null, 'def', NaN, Infinity, -Infinity, undefined, 'bar'],
        },
        {
          writeArrayIndexes: true,
        },
      ),
    ).toEqual(`foo${uriBracketsZero}=abc&foo${uriBracketsOne}=def&foo${uriBracketsTwo}=bar`);
  });

  it('should work with array params containing objects in dot notation', () => {
    expect(
      buildQueryString(
        {
          filters: [{ name: 'category', values: ['Stuff', 'Other'] }],
        },
        {
          objectNotation: 'dot',
          writeArrayIndexes: true,
        },
      ),
    ).toEqual(
      `filters${uriBracketsZero}${dot}name=category&filters${uriBracketsZero}${dot}values${uriBracketsZero}=Stuff&filters${uriBracketsZero}${dot}values${uriBracketsOne}=Other`,
    );
  });

  it('should work with array params containing objects in bracket notation', () => {
    expect(
      buildQueryString(
        {
          filters: [{ name: 'category', values: ['Stuff', 'Other'] }],
        },
        {
          objectNotation: 'bracket',
          writeArrayIndexes: true,
        },
      ),
    ).toEqual(
      `filters${uriBracketsZero}${brOpen}name${brClose}=category&filters${uriBracketsZero}${brOpen}values${brClose}${uriBracketsZero}=Stuff&filters${uriBracketsZero}${brOpen}values${brClose}${uriBracketsOne}=Other`,
    );
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
        route: 'foo' as V2RouteString,
      });
    }).toThrow(invalidRouteError('foo'));
  });
});
