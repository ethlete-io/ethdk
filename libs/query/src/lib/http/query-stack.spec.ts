import { HttpHeaders, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createQueryClient } from './query-client';
import { createQueryCreator } from './query-creator';
import { QueryFeatureType, withSuccessHandling } from './query-features';
import { createQueryStack, transformArrayResponse, transformPaginatedResponse } from './query-stack';

describe('createQueryStack', () => {
  let client: ReturnType<typeof createQueryClient>;

  beforeEach(() => {
    client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'test' });

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  describe('basic functionality', () => {
    it('should create a query stack', () => {
      TestBed.runInInjectionContext(() => {
        const queryCreator = createQueryCreator(undefined, {
          client,
          method: 'GET',
          route: '/posts/:postId',
        });

        const stack = createQueryStack({
          queryCreator,
          args: () => ({ pathParams: { postId: '1' } }),
        });

        TestBed.flushEffects();

        expect(stack).toBeTruthy();
        expect(stack.queries()).toHaveLength(1);
      });
    });

    it('should create multiple queries from array args', () => {
      TestBed.runInInjectionContext(() => {
        const queryCreator = createQueryCreator(undefined, {
          client,
          method: 'GET',
          route: '/posts/:postId',
        });

        const stack = createQueryStack({
          queryCreator,
          args: () => [{ pathParams: { postId: '1' } }, { pathParams: { postId: '2' } }],
        });

        TestBed.flushEffects();

        expect(stack.queries()).toHaveLength(2);
      });
    });

    it('should return null queries when args returns null', () => {
      TestBed.runInInjectionContext(() => {
        const queryCreator = createQueryCreator(undefined, {
          client,
          method: 'GET',
          route: '/posts/:postId',
        });

        const stack = createQueryStack({
          queryCreator,
          args: () => null,
        });

        expect(stack.queries()).toHaveLength(0);
      });
    });

    it('should provide firstQuery and lastQuery signals', () => {
      TestBed.runInInjectionContext(() => {
        const queryCreator = createQueryCreator(undefined, {
          client,
          method: 'GET',
          route: '/posts/:postId',
        });

        const stack = createQueryStack({
          queryCreator,
          args: () => [{ pathParams: { postId: '1' } }, { pathParams: { postId: '2' } }],
        });

        TestBed.flushEffects();

        expect(stack.firstQuery()).toBe(stack.queries()[0]);
        expect(stack.lastQuery()).toBe(stack.queries()[1]);
      });
    });
  });

  describe('append mode', () => {
    it('should append new queries instead of replacing', () => {
      TestBed.runInInjectionContext(() => {
        const queryCreator = createQueryCreator(undefined, {
          client,
          method: 'GET',
          route: '/posts/:postId',
        });

        const postId = signal('1');

        const stack = createQueryStack({
          queryCreator,
          args: () => ({ pathParams: { postId: postId() } }),
          append: true,
        });

        TestBed.flushEffects();

        expect(stack.queries()).toHaveLength(1);

        postId.set('2');
        TestBed.flushEffects();

        expect(stack.queries()).toHaveLength(2);
      });
    });

    it('should use custom appendFn', () => {
      TestBed.runInInjectionContext(() => {
        const queryCreator = createQueryCreator(undefined, {
          client,
          method: 'GET',
          route: '/posts/:postId',
        });

        const postId = signal('1');

        const stack = createQueryStack({
          queryCreator,
          args: () => ({ pathParams: { postId: postId() } }),
          append: true,
          appendFn: (oldQueries, newQueries) => ({
            queries: [...newQueries, ...oldQueries], // Prepend instead of append
            lastQuery: newQueries[newQueries.length - 1] ?? null,
          }),
        });

        TestBed.flushEffects();

        const firstQueryId = stack.queries()[0]?.id();

        postId.set('2');
        TestBed.flushEffects();

        // New query should be first
        expect(stack.queries()[1]?.id()).toBe(firstQueryId);
      });
    });

    it('should respect maxQueries limit with oldest removal strategy', () => {
      TestBed.runInInjectionContext(() => {
        type GetPostArgs = {
          pathParams: {
            postId: string;
          };
        };

        const queryCreator = createQueryCreator<GetPostArgs>(undefined, {
          client,
          method: 'GET',
          route: (p) => `/posts/${p.postId}`,
        });

        const stack = createQueryStack({
          queryCreator,
          args: () => null,
          append: true,
          maxQueries: 3,
          removeStrategy: 'oldest',
        });

        TestBed.flushEffects();

        stack.subtle.runWithArgs({ pathParams: { postId: '1' } });
        TestBed.flushEffects();
        const firstQueryId = stack.queries()[0]?.id();

        stack.subtle.runWithArgs({ pathParams: { postId: '2' } });
        TestBed.flushEffects();
        stack.subtle.runWithArgs({ pathParams: { postId: '3' } });
        TestBed.flushEffects();
        stack.subtle.runWithArgs({ pathParams: { postId: '4' } });
        TestBed.flushEffects();

        expect(stack.queries()).toHaveLength(3);
        // First query should be removed
        expect(stack.queries().some((q) => q.id() === firstQueryId)).toBe(false);
      });
    });

    it('should respect maxQueries limit with newest removal strategy', () => {
      TestBed.runInInjectionContext(() => {
        const queryCreator = createQueryCreator(undefined, {
          client,
          method: 'GET',
          route: '/posts/:postId',
        });

        const postId = signal(1);

        const stack = createQueryStack({
          queryCreator,
          args: () => ({ pathParams: { postId: postId().toString() } }),
          append: true,
          maxQueries: 3,
          removeStrategy: 'newest',
        });

        TestBed.flushEffects();

        const firstQueryId = stack.queries()[0]?.id();

        postId.set(2);
        TestBed.flushEffects();
        postId.set(3);
        TestBed.flushEffects();
        postId.set(4);
        TestBed.flushEffects();

        expect(stack.queries()).toHaveLength(3);
        // First query should still exist
        expect(stack.queries().some((q) => q.id() === firstQueryId)).toBe(true);
      });
    });
  });

  describe('deduplication', () => {
    it('should deduplicate args by default', () => {
      TestBed.runInInjectionContext(() => {
        const queryCreator = createQueryCreator(undefined, {
          client,
          method: 'GET',
          route: '/posts/:postId',
        });

        const postId = signal('1');

        const stack = createQueryStack({
          queryCreator,
          args: () => [{ pathParams: { postId: postId() } }, { pathParams: { postId: postId() } }],
          append: true,
        });

        TestBed.flushEffects();

        expect(stack.queries()).toHaveLength(1);

        postId.set('2');
        TestBed.flushEffects();

        expect(stack.queries()).toHaveLength(2);
      });
    });

    it('should allow disabling deduplication', () => {
      TestBed.runInInjectionContext(() => {
        const queryCreator = createQueryCreator(undefined, {
          client,
          method: 'GET',
          route: '/posts/:postId',
        });

        const stack = createQueryStack({
          queryCreator,
          args: () => [{ pathParams: { postId: '1' } }, { pathParams: { postId: '1' } }],
          deduplicateArgs: false,
        });

        TestBed.flushEffects();

        expect(stack.queries()).toHaveLength(2);
      });
    });

    it('should use custom argsKeyFn for deduplication', () => {
      TestBed.runInInjectionContext(() => {
        const queryCreator = createQueryCreator(undefined, {
          client,
          method: 'GET',
          route: '/posts/:postId',
        });

        const headersA = new HttpHeaders({ 'X-Custom': 'a' });
        const headersB = new HttpHeaders({ 'X-Custom': 'b' });

        const stack = createQueryStack({
          queryCreator,
          args: () => [
            { pathParams: { postId: '1' }, headers: headersA },
            { pathParams: { postId: '1' }, headers: headersB },
          ],
          argsKeyFn: (args) => (args?.pathParams?.['postId'] as string) ?? '',
          append: true,
        });

        TestBed.flushEffects();

        // Should be deduplicated based on postId only
        expect(stack.queries()).toHaveLength(1);
      });
    });
  });

  describe('loading states', () => {
    it('should provide anyLoading signal', () => {
      TestBed.runInInjectionContext(() => {
        const queryCreator = createQueryCreator(undefined, {
          client,
          method: 'GET',
          route: '/posts/:postId',
        });

        const stack = createQueryStack({
          queryCreator,
          args: () => ({ pathParams: { postId: '1' } }),
        });

        expect(stack.anyLoading()).toBe(false);
      });
    });

    it('should provide loadingCount signal', () => {
      TestBed.runInInjectionContext(() => {
        const queryCreator = createQueryCreator(undefined, {
          client,
          method: 'GET',
          route: '/posts/:postId',
        });

        const stack = createQueryStack({
          queryCreator,
          args: () => [{ pathParams: { postId: '1' } }, { pathParams: { postId: '2' } }],
        });

        expect(stack.loadingCount()).toBe(0);
      });
    });

    it('should provide allLoading signal', () => {
      TestBed.runInInjectionContext(() => {
        const queryCreator = createQueryCreator(undefined, {
          client,
          method: 'GET',
          route: '/posts/:postId',
        });

        const stack = createQueryStack({
          queryCreator,
          args: () => [{ pathParams: { postId: '1' } }, { pathParams: { postId: '2' } }],
        });

        expect(stack.allLoading()).toBe(false);
      });
    });

    it('should provide loadingProgress signal', () => {
      TestBed.runInInjectionContext(() => {
        const queryCreator = createQueryCreator(undefined, {
          client,
          method: 'GET',
          route: '/posts/:postId',
        });

        const stack = createQueryStack({
          queryCreator,
          args: () => [{ pathParams: { postId: '1' } }, { pathParams: { postId: '2' } }],
        });

        TestBed.flushEffects();

        expect(stack.loadingProgress()).toEqual({ loaded: 0, total: 2 });
      });
    });
  });

  describe('error handling', () => {
    it('should provide anyError signal', () => {
      TestBed.runInInjectionContext(() => {
        const queryCreator = createQueryCreator(undefined, {
          client,
          method: 'GET',
          route: '/posts/:postId',
        });

        const stack = createQueryStack({
          queryCreator,
          args: () => ({ pathParams: { postId: '1' } }),
        });

        expect(stack.anyError()).toBeNull();
      });
    });

    it('should provide errors array signal', () => {
      TestBed.runInInjectionContext(() => {
        const queryCreator = createQueryCreator(undefined, {
          client,
          method: 'GET',
          route: '/posts/:postId',
        });

        const stack = createQueryStack({
          queryCreator,
          args: () => [{ pathParams: { postId: '1' } }, { pathParams: { postId: '2' } }],
        });

        expect(stack.errors()).toHaveLength(0);
      });
    });

    it('should retry failed queries', () => {
      TestBed.runInInjectionContext(() => {
        const queryCreator = createQueryCreator(undefined, {
          client,
          method: 'GET',
          route: '/posts/:postId',
        });

        const stack = createQueryStack({
          queryCreator,
          args: () => ({ pathParams: { postId: '1' } }),
        });

        expect(() => stack.retryFailed()).not.toThrow();
      });
    });
  });

  describe('transform', () => {
    it('should transform responses', () => {
      TestBed.runInInjectionContext(() => {
        const queryCreator = createQueryCreator<{ response: string[] }>(undefined, {
          client,
          method: 'GET',
          route: '/posts/:postId',
        });

        const stack = createQueryStack({
          queryCreator,
          args: () => [{ pathParams: { postId: '1' } }, { pathParams: { postId: '2' } }],
          transform: transformArrayResponse,
        });

        expect(stack.response()).toBeDefined();
      });
    });

    it('should use transformArrayResponse helper', () => {
      const responses = [['a', 'b'], ['c', 'd'], null];
      const result = transformArrayResponse(responses);

      expect(result).toEqual(['a', 'b', 'c', 'd']);
    });

    it('should use transformPaginatedResponse helper', () => {
      const responses = [{ items: ['a', 'b'] }, { items: ['c', 'd'] }, null];
      const result = transformPaginatedResponse(responses);

      expect(result).toEqual(['a', 'b', 'c', 'd']);
    });
  });

  describe('dependencies', () => {
    it('should clear stack when dependencies change', () => {
      TestBed.runInInjectionContext(() => {
        const queryCreator = createQueryCreator(undefined, {
          client,
          method: 'GET',
          route: '/posts/:postId',
        });

        const dep = signal(1);

        const stack = createQueryStack({
          queryCreator,
          dependencies: () => ({ page: dep() }),
          args: ({ page }) => ({ pathParams: { postId: page.toString() } }),
          append: true,
        });

        TestBed.flushEffects();

        expect(stack.queries()).toHaveLength(1);

        dep.set(2);
        TestBed.flushEffects();

        // Should have cleared and created new query
        expect(stack.queries()).toHaveLength(1);
      });
    });
  });

  describe('actions', () => {
    it('should execute all queries', () => {
      TestBed.runInInjectionContext(() => {
        const queryCreator = createQueryCreator(undefined, {
          client,
          method: 'GET',
          route: '/posts/:postId',
        });

        const stack = createQueryStack({
          queryCreator,
          args: () => [{ pathParams: { postId: '1' } }, { pathParams: { postId: '2' } }],
        });

        expect(() => stack.execute()).not.toThrow();
        expect(() => stack.execute({ allowCache: false })).not.toThrow();
      });
    });

    it('should clear all queries', () => {
      TestBed.runInInjectionContext(() => {
        const queryCreator = createQueryCreator(undefined, {
          client,
          method: 'GET',
          route: '/posts/:postId',
        });

        const stack = createQueryStack({
          queryCreator,
          args: () => [{ pathParams: { postId: '1' } }, { pathParams: { postId: '2' } }],
          append: true,
        });

        TestBed.flushEffects();

        expect(stack.queries()).toHaveLength(2);

        stack.clear();

        expect(stack.queries()).toHaveLength(0);
        expect(stack.lastQuery()).toBeNull();
      });
    });
  });

  describe('subtle API', () => {
    it('should provide runWithArgs method', () => {
      TestBed.runInInjectionContext(() => {
        const queryCreator = createQueryCreator(undefined, {
          client,
          method: 'GET',
          route: '/posts/:postId',
        });

        const stack = createQueryStack({
          queryCreator,
          args: () => ({ pathParams: { postId: '1' } }),
        });

        const result = stack.subtle.runWithArgs({ pathParams: { postId: '2' } });

        expect(result).toBeTruthy();
      });
    });

    it('should handle null args in runWithArgs', () => {
      TestBed.runInInjectionContext(() => {
        const queryCreator = createQueryCreator(undefined, {
          client,
          method: 'GET',
          route: '/posts/:postId',
        });

        const stack = createQueryStack({
          queryCreator,
          args: () => ({ pathParams: { postId: '1' } }),
        });

        const result = stack.subtle.runWithArgs(null);

        expect(result).toBeNull();
      });
    });
  });

  describe('features', () => {
    it('should apply features to all queries', () => {
      TestBed.runInInjectionContext(() => {
        const queryCreator = createQueryCreator<{ response: { title: string } }>(undefined, {
          client,
          method: 'GET',
          route: '/posts/:postId',
        });

        const handler = vi.fn();

        const stack = createQueryStack({
          queryCreator,
          args: () => [{ pathParams: { postId: '1' } }, { pathParams: { postId: '2' } }],
          features: [withSuccessHandling({ handler })],
        });

        TestBed.flushEffects();

        expect(stack.queries()).toHaveLength(2);
      });
    });

    it('should throw if withArgs feature is used', () => {
      TestBed.runInInjectionContext(() => {
        const queryCreator = createQueryCreator(undefined, {
          client,
          method: 'GET',
          route: '/posts/:postId',
        });

        expect(() => {
          createQueryStack({
            queryCreator,
            args: () => ({ pathParams: { postId: '1' } }),
            features: [
              {
                type: QueryFeatureType.WITH_ARGS,
                fn: () => ({}),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              } as any,
            ],
          });
        }).toThrow();
      });
    });
  });

  describe('replace mode', () => {
    it('should destroy old queries when not in append mode', () => {
      TestBed.runInInjectionContext(() => {
        type GetPostArgs = {
          pathParams: {
            postId: string;
          };
        };

        const queryCreator = createQueryCreator<GetPostArgs>(undefined, {
          client,
          method: 'GET',
          route: (p) => `/posts/${p.postId}`,
        });

        const postIds = signal(['1', '2']);

        const stack = createQueryStack({
          queryCreator,
          args: () => postIds().map((id) => ({ pathParams: { postId: id } })),
          append: false,
        });

        TestBed.flushEffects();

        expect(stack.queries()).toHaveLength(2);
        const firstQuery = stack.queries()[0];
        const secondQuery = stack.queries()[1];
        const firstQueryId = firstQuery?.id();
        const secondQueryId = secondQuery?.id();

        postIds.set(['3', '4']);
        TestBed.flushEffects();

        expect(stack.queries()).toHaveLength(2);
        const newFirstArgs = JSON.stringify(stack.queries()[0]?.args());
        const newSecondArgs = JSON.stringify(stack.queries()[1]?.args());

        expect(newFirstArgs).toContain('"postId":"3"');
        expect(newSecondArgs).toContain('"postId":"4"');

        const currentIds = stack.queries().map((q) => q.id());
        expect(currentIds).not.toContain(firstQueryId);
        expect(currentIds).not.toContain(secondQueryId);
      });
    });

    it('should preserve queries that still exist in new args', () => {
      TestBed.runInInjectionContext(() => {
        type GetPostArgs = {
          pathParams: {
            postId: string;
          };
        };

        const queryCreator = createQueryCreator<GetPostArgs>(undefined, {
          client,
          method: 'GET',
          route: (p) => `/posts/${p.postId}`,
        });

        const postIds = signal(['1', '2']);

        const stack = createQueryStack({
          queryCreator,
          args: () => postIds().map((id) => ({ pathParams: { postId: id } })),
          append: false,
        });

        TestBed.flushEffects();

        const firstQueryId = stack.queries()[0]?.id();

        postIds.set(['1', '3']);
        TestBed.flushEffects();

        expect(stack.queries()).toHaveLength(2);
        expect(stack.queries()[0]?.id()).toBe(firstQueryId);
      });
    });
  });
});
