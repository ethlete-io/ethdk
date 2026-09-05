import { EnvironmentProviders } from '@angular/core';
import { parseQueryRoute, provideQueryDevtools, stringifyQueryRouteParts } from './query-devtools-registry';

/** What `makeEnvironmentProviders()` wraps, so a spec can tell an empty set from a populated one. */
const providersIn = (providers: EnvironmentProviders) => (providers as unknown as { ɵproviders: unknown[] }).ɵproviders;

describe('query devtools registry', () => {
  describe('provideQueryDevtools', () => {
    it('should warn instead of dropping the options of a second provideQueryDevtools call', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      provideQueryDevtools({ responseHistory: 5 });

      const second = provideQueryDevtools({ apiEnvs: [{ name: 'Hub API', storageKey: 'hubApiEnv', envs: [] }] });

      expect(warn.mock.calls.flat().join(' ')).toContain('apiEnvs');
      expect(providersIn(second).length).toBeGreaterThan(0);

      warn.mockRestore();
    });
  });

  describe('parseQueryRoute', () => {
    it('should return a single static part for a literal route', () => {
      expect(parseQueryRoute('/posts')).toEqual([{ text: '/posts', param: null }]);
    });

    it('should return nothing for a missing route', () => {
      expect(parseQueryRoute(null)).toEqual([]);
      expect(parseQueryRoute(undefined)).toEqual([]);
    });

    it('should record the path params a route function reads', () => {
      expect(parseQueryRoute((p: { postId: string }) => `/post/${p.postId}/comments`)).toEqual([
        { text: '/post/', param: null },
        { text: 'postId', param: 'postId' },
        { text: '/comments', param: null },
      ]);
    });

    it('should record a param at the end of a route', () => {
      expect(parseQueryRoute((p: { id: string }) => `/team/${p.id}`)).toEqual([
        { text: '/team/', param: null },
        { text: 'id', param: 'id' },
      ]);
    });

    it('should record several params, including the same one twice', () => {
      expect(parseQueryRoute((p: { a: string; b: string }) => `/${p.a}/x/${p.b}/y/${p.a}`)).toEqual([
        { text: '/', param: null },
        { text: 'a', param: 'a' },
        { text: '/x/', param: null },
        { text: 'b', param: 'b' },
        { text: '/y/', param: null },
        { text: 'a', param: 'a' },
      ]);
    });

    it('should read destructured params', () => {
      expect(parseQueryRoute(({ postId }: { postId: string }) => `/post/${postId}`)).toEqual([
        { text: '/post/', param: null },
        { text: 'postId', param: 'postId' },
      ]);
    });

    it('should survive a route function that transforms what it reads', () => {
      expect(parseQueryRoute((p: { id: string }) => `/team/${p.id.toUpperCase()}`)).toEqual([
        { text: '/team/', param: null },
        { text: 'ID', param: 'ID' },
      ]);
    });

    it('should fall back to a placeholder when the route function throws', () => {
      expect(
        parseQueryRoute(() => {
          throw new Error('nope');
        }),
      ).toEqual([{ text: '(dynamic route)', param: null }]);
    });
  });

  describe('stringifyQueryRouteParts', () => {
    it('should render params as named placeholders', () => {
      expect(stringifyQueryRouteParts(parseQueryRoute((p: { postId: string }) => `/post/${p.postId}`))).toBe(
        '/post/:postId',
      );
    });

    it('should render a literal route unchanged', () => {
      expect(stringifyQueryRouteParts(parseQueryRoute('/posts'))).toBe('/posts');
    });

    it('should render nothing for a missing route', () => {
      expect(stringifyQueryRouteParts(parseQueryRoute(null))).toBe('');
    });
  });
});
