import { describe, expect, it } from 'vitest';
import { HttpRequest } from './http-request';
import { QueryArgs } from './query';
import {
  createQueryInvalidationFilter,
  isUnderInvalidatedUrl,
  resolveInvalidationUrl,
  resolveQueryTags,
} from './query-invalidation';

const BASE_URL = 'https://api.example.com/v1';

const request = (url: string, method = 'GET') => ({ url, method }) as HttpRequest<QueryArgs>;

describe('resolveInvalidationUrl', () => {
  it('should resolve a route against the base url', () => {
    expect(resolveInvalidationUrl(BASE_URL, '/players')).toBe('https://api.example.com/v1/players');
  });

  it('should take an absolute url as it is', () => {
    expect(resolveInvalidationUrl(BASE_URL, 'https://cdn.example.com/players')).toBe('https://cdn.example.com/players');
  });

  it('should drop a trailing slash', () => {
    expect(resolveInvalidationUrl(BASE_URL, '/players/')).toBe('https://api.example.com/v1/players');
  });
});

describe('isUnderInvalidatedUrl', () => {
  const invalidated = 'https://api.example.com/v1/players';

  it('should match the url itself', () => {
    expect(isUnderInvalidatedUrl(invalidated, invalidated)).toBe(true);
  });

  it('should match a url below it', () => {
    expect(isUnderInvalidatedUrl(`${invalidated}/1`, invalidated)).toBe(true);
  });

  it('should match it with query params or a fragment', () => {
    expect(isUnderInvalidatedUrl(`${invalidated}?page=2`, invalidated)).toBe(true);
    expect(isUnderInvalidatedUrl(`${invalidated}#top`, invalidated)).toBe(true);
  });

  it('should not match a sibling that merely starts the same', () => {
    expect(isUnderInvalidatedUrl(`${invalidated}-archive`, invalidated)).toBe(false);
  });

  it('should not match a url above it', () => {
    expect(isUnderInvalidatedUrl('https://api.example.com/v1', invalidated)).toBe(false);
  });
});

describe('createQueryInvalidationFilter', () => {
  it('should be undefined when nothing narrows the invalidation', () => {
    expect(createQueryInvalidationFilter({ url: null })).toBeUndefined();
  });

  it('should narrow by url', () => {
    const filter = createQueryInvalidationFilter({ url: 'https://api.example.com/v1/players' });

    expect(filter?.(request('https://api.example.com/v1/players/1'))).toBe(true);
    expect(filter?.(request('https://api.example.com/v1/teams'))).toBe(false);
  });

  it('should hand the built method and url to a filter fn', () => {
    const seen: unknown[] = [];
    const filter = createQueryInvalidationFilter({ url: null, filter: (query) => (seen.push(query), true) });

    filter?.(request('https://api.example.com/v1/players'));

    expect(seen).toEqual([{ method: 'GET', url: 'https://api.example.com/v1/players' }]);
  });

  it('should run the filter fn only for what the url already covers', () => {
    const seen: string[] = [];
    const filter = createQueryInvalidationFilter({
      url: 'https://api.example.com/v1/players',
      filter: (query) => (seen.push(query.url), true),
    });

    expect(filter?.(request('https://api.example.com/v1/teams'))).toBe(false);
    expect(seen).toEqual([]);
  });
});

describe('createQueryInvalidationFilter by tag', () => {
  it('should match only an entry that declared the tag', () => {
    const filter = createQueryInvalidationFilter({ url: null, tag: 'player:1' });

    expect(filter?.(request('https://api.example.com/v1/players/1'), ['player:1', 'players'])).toBe(true);
    expect(filter?.(request('https://api.example.com/v1/players/2'), ['player:2'])).toBe(false);
    expect(filter?.(request('https://api.example.com/v1/players/3'))).toBe(false);
  });

  it('should require both the url and the tag when both are given', () => {
    const filter = createQueryInvalidationFilter({ url: 'https://api.example.com/v1/players', tag: 'player:1' });

    expect(filter?.(request('https://api.example.com/v1/players/1'), ['player:1'])).toBe(true);
    expect(filter?.(request('https://api.example.com/v1/teams/1'), ['player:1'])).toBe(false);
  });
});

describe('resolveQueryTags', () => {
  it('should return static tags as they are', () => {
    expect(resolveQueryTags(['players'], null)).toEqual(['players']);
  });

  it('should hand the args to a tags fn', () => {
    const tags = resolveQueryTags<{ response: unknown; pathParams: { id: string } }>(
      ({ args }) => [`player:${args.pathParams.id}`],
      { pathParams: { id: '7' } },
    );

    expect(tags).toEqual(['player:7']);
  });

  it('should hand an empty args object to a tags fn of an argless read', () => {
    expect(resolveQueryTags(({ args }) => [Object.keys(args).length === 0 ? 'empty' : 'args'], null)).toEqual([
      'empty',
    ]);
  });
});
