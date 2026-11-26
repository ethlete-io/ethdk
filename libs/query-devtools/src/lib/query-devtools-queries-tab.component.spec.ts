import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { QueryDevtoolsEntry } from '@ethlete/query/devtools-contract';
import { describe, expect, it } from 'vitest';
import { QUERY_DEVTOOLS_HOST, QueryDevtoolsHost } from './query-devtools-host';
import { QueryDevtoolsQueriesTabComponent } from './query-devtools-queries-tab.component';
import { QueryListFacet, QueryStatus, RouteSegment } from './query-devtools-types';
import { createQueryDevtoolsTestHost } from './testing/query-devtools-test-host';

type FakeQuery = { status: QueryStatus; url: string | null };

type FakeEntryInit = { id: string; method?: string; route: string; status?: QueryStatus; url?: string; ranAt?: number };

const fakeEntry = ({ id, method = 'GET', route, status = 'success', url, ranAt }: FakeEntryInit) =>
  ({
    id,
    kind: 'query',
    meta: { method, route, clientName: 'api' },
    handle: { status, url: url ?? `https://api.test${route}`, lastTimeExecutedAt: () => ranAt ?? null },
    destroyedAt: null,
  }) as unknown as QueryDevtoolsEntry;

const fakeOf = (query: unknown) => query as FakeQuery;

const mount = (initial: QueryDevtoolsEntry[]) => {
  const entries = signal(initial);
  const queryFilter = signal('');
  const queryFacets = signal<ReadonlySet<QueryListFacet>>(new Set());
  const selectedQueryId = signal<string | null>(null);
  const expandedQueryGroups = signal<ReadonlySet<string>>(new Set());

  const host = createQueryDevtoolsTestHost({
    scopedQueries: entries,
    queryFilter,
    queryFacets,
    selectedQueryId,
    selectedQuery: signal(null),
    selectedClientName: signal(null),
    inspectFilterIds: signal(null),
    pinnedQueryIds: signal(new Set()),
    collapsedQueryPaths: signal(new Set()),
    expandedQueryGroups,
    clock: signal(0),
    expandQueryGroup: (key: string) => expandedQueryGroups.update((keys) => new Set([...keys, key])),
    toggleFacet: (facet: QueryListFacet) =>
      queryFacets.update((facets) => {
        const next = new Set(facets);
        if (!next.delete(facet)) next.add(facet);
        return next;
      }),
    clearQueryFilters: () => {
      queryFilter.set('');
      queryFacets.set(new Set());
    },
    queryStatus: (query: unknown) => fakeOf(query).status,
    isStale: () => false,
    isTampered: () => false,
    isQueryPinned: () => false,
    batchOf: () => null,
    requestProgress: () => null,
    locatableElement: () => null,
    formatTime: () => '',
    requestUrl: (query: unknown) => fakeOf(query).url,
    requestPath: (url: string) => new URL(url).pathname + new URL(url).search,
    routeSegments: (entry: QueryDevtoolsEntry): RouteSegment[] => [{ text: entry.meta.route ?? '', kind: 'static' }],
  } as unknown as Partial<QueryDevtoolsHost>);

  TestBed.configureTestingModule({
    imports: [QueryDevtoolsQueriesTabComponent],
    providers: [provideZonelessChangeDetection(), { provide: QUERY_DEVTOOLS_HOST, useValue: host }],
  });

  const fixture = TestBed.createComponent(QueryDevtoolsQueriesTabComponent);
  const element = fixture.nativeElement as HTMLElement;

  const rows = () =>
    [...element.querySelectorAll('.et-query-devtools-row:not(.et-query-devtools-row--nested)')].map((row) =>
      row.querySelector('.et-query-devtools-route')?.textContent?.trim(),
    );
  const text = (selector: string) => element.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const search = async (term: string) => {
    const input = element.querySelector<HTMLInputElement>('.et-query-devtools-search');

    if (!input) throw new Error('No search box');

    input.value = term;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };

  return { fixture, element, entries, queryFilter, queryFacets, selectedQueryId, rows, text, search };
};

describe('QueryDevtoolsQueriesTabComponent', () => {
  describe('with no queries', () => {
    it('should say that nothing is registered and disable the export', async () => {
      const { fixture, element, text, rows } = mount([]);
      await fixture.whenStable();

      expect(rows()).toEqual([]);
      expect(text('.et-query-devtools-list .et-query-devtools-empty')).toContain('No queries registered');
      expect(text('.et-query-devtools-count')).toBe('0');
      expect(
        element.querySelector<HTMLButtonElement>('.et-query-devtools-toolbar .et-query-devtools-btn')?.disabled,
      ).toBe(true);
      expect(element.querySelectorAll('.et-query-devtools-facet')).toHaveLength(0);
    });

    it('should not claim a filter is to blame when a search runs over nothing', async () => {
      const { fixture, text, search } = mount([]);
      await fixture.whenStable();

      await search('users');

      expect(text('.et-query-devtools-list .et-query-devtools-empty')).toContain('No queries registered');
      expect(text('.et-query-devtools-count')).toBe('0 of 0');
    });

    it('should show the empty detail placeholder', async () => {
      const { fixture, text } = mount([]);
      await fixture.whenStable();

      expect(text('.et-query-devtools-detail')).toBe('Select a query to inspect it.');
    });
  });

  describe('with thousands of queries', () => {
    const many = (count: number, routes = count) =>
      Array.from({ length: count }, (_, i) => fakeEntry({ id: `q${i}`, route: `/items/${i % routes}`, ranAt: i + 1 }));

    it('should render every distinct query as its own row, newest first', async () => {
      const { fixture, element, rows, text } = mount(many(250));
      TestBed.inject(QUERY_DEVTOOLS_HOST).queryRecentFirst.set(true);
      await fixture.whenStable();

      const rendered = rows();

      expect(rendered).toHaveLength(250);
      expect(rendered[0]).toBe('/items/249');
      expect(rendered.at(-1)).toBe('/items/0');
      expect(text('.et-query-devtools-count')).toBe('250');
      expect(element.querySelectorAll('.et-query-devtools-row--group')).toHaveLength(0);
    }, 30_000);

    it('should fold thousands of identical queries into one row', async () => {
      const { fixture, element, rows } = mount(many(2000, 1));
      await fixture.whenStable();

      expect(rows()).toEqual(['/items/0']);
      expect(element.querySelector('.et-query-devtools-row-count')?.textContent?.trim()).toBe('×2000');
    });

    it('should narrow thousands of queries with a search', async () => {
      const { fixture, rows, text, queryFilter } = mount(many(5000));
      queryFilter.set('/items/299');
      await fixture.whenStable();

      expect(rows().sort()).toEqual(['/items/299', ...Array.from({ length: 10 }, (_, i) => `/items/299${i}`)].sort());
      expect(text('.et-query-devtools-count')).toBe('11 of 5000');
    });

    it('should drop the active row when the selected query leaves the registry', async () => {
      const { fixture, element, entries, selectedQueryId } = mount(many(3000, 30));
      selectedQueryId.set('q1500');
      await fixture.whenStable();

      expect(element.querySelectorAll('.et-query-devtools-row--active')).toHaveLength(2);

      entries.update((list) => list.filter((entry) => entry.id !== 'q1500'));
      await fixture.whenStable();

      expect(element.querySelectorAll('.et-query-devtools-row--active')).toHaveLength(0);
      expect(element.querySelectorAll('.et-query-devtools-row--nested')).toHaveLength(99);
    });

    it('should keep a selected query that dies as a gone row, and only while no chip is on', async () => {
      const { fixture, element, entries, selectedQueryId, queryFacets } = mount(many(3000, 30));
      selectedQueryId.set('q10');
      await fixture.whenStable();

      entries.update((list) =>
        list.map((entry) => (entry.id === 'q10' ? ({ ...entry, destroyedAt: 5 } as QueryDevtoolsEntry) : entry)),
      );
      await fixture.whenStable();

      const active = element.querySelector('.et-query-devtools-row--active');

      expect(active?.classList).toContain('et-query-devtools-row--gone');
      expect(element.querySelectorAll('.et-query-devtools-row:not(.et-query-devtools-row--nested)')).toHaveLength(31);

      queryFacets.set(new Set(['error']));
      await fixture.whenStable();

      expect(element.querySelector('.et-query-devtools-row--active')).toBeNull();
    });

    it('should open the fold when the selection lands on a member the fold does not render', async () => {
      const { fixture, element, selectedQueryId } = mount(many(300, 1));
      await fixture.whenStable();

      selectedQueryId.set('q150');
      await fixture.whenStable();

      expect(element.querySelectorAll('.et-query-devtools-row--nested')).toHaveLength(300);
      expect(element.querySelector('.et-query-devtools-row--nested.et-query-devtools-row--active')).not.toBeNull();
    });
  });
  describe('search', () => {
    const entries = () => [
      fakeEntry({ id: 'a', method: 'GET', route: '/users', ranAt: 3 }),
      fakeEntry({ id: 'b', method: 'POST', route: '/users', ranAt: 2 }),
      fakeEntry({ id: 'c', method: 'GET', route: '/posts', status: 'error', ranAt: 1 }),
      fakeEntry({
        id: 'd',
        method: 'GET',
        route: '/search',
        url: 'https://api.test/search?q=a.b*(c)%5B1%5D&tag=%24x',
        ranAt: 4,
      }),
      fakeEntry({ id: 'e', method: 'GET', route: '/posts/:id', url: 'https://api.test/posts/42', status: 'error' }),
    ];

    it('should list everything for an empty or blank search and not count it as a filter', async () => {
      const { fixture, element, rows, text, search } = mount(entries());
      await fixture.whenStable();

      await search('   ');

      expect(rows()).toHaveLength(5);
      expect(text('.et-query-devtools-count')).toBe('5');
      expect(element.querySelector('[aria-label="Clear filters"]')).toBeNull();
    });

    it('should say how many are in scope when nothing matches', async () => {
      const { fixture, rows, text, search } = mount(entries());
      await fixture.whenStable();

      await search('nothing-like-this');

      expect(rows()).toEqual([]);
      expect(text('.et-query-devtools-list .et-query-devtools-empty')).toBe(
        'No query matches the filter · 5 in scope.',
      );
      expect(text('.et-query-devtools-count')).toBe('0 of 5');
    });

    it('should treat regex characters literally', async () => {
      const { fixture, rows, search } = mount(entries());
      await fixture.whenStable();

      for (const term of ['a.b*(c)', '%5b1%5d', '?q=', '%24x', '.*', '[', '(', '\\']) {
        await search(term);

        expect(rows(), term).toEqual(['a.b*(c)', '%5b1%5d', '?q=', '%24x', '('].includes(term) ? ['/search'] : []);
      }
    });

    it('should ignore case in both the term and the row', async () => {
      const { fixture, rows, search } = mount(entries());
      await fixture.whenStable();

      await search('post');
      expect(rows().sort()).toEqual(['/posts', '/posts/:id', '/users']);

      await search('POST /USERS');
      expect(rows()).toEqual(['/users']);
    });

    it('should match the path a query actually requested, not only its template', async () => {
      const { fixture, rows, search } = mount(entries());
      await fixture.whenStable();

      await search('/posts/42');

      expect(rows()).toEqual(['/posts/:id']);
    });

    it('should require every term to match', async () => {
      const { fixture, rows, search } = mount(entries());
      await fixture.whenStable();

      await search('get users');
      expect(rows()).toEqual(['/users']);

      await search('get users posts');
      expect(rows()).toEqual([]);
    });

    it('should combine a search with a status chip and count chips over the searched set', async () => {
      const { fixture, element, rows, text, search, queryFacets } = mount(entries());
      await fixture.whenStable();

      await search('posts');

      const chip = () =>
        [...element.querySelectorAll('.et-query-devtools-facet')].map((facet) =>
          facet.textContent?.replace(/\s+/g, ' ').trim(),
        );

      expect(chip()).toEqual(['Failing 2']);

      await search('get');
      expect(chip()).toEqual(['Failing 2']);

      queryFacets.set(new Set(['error']));
      await fixture.whenStable();
      expect(rows().sort()).toEqual(['/posts', '/posts/:id']);
      expect(text('.et-query-devtools-count')).toBe('2 of 5');

      await search('42');
      expect(rows()).toEqual(['/posts/:id']);

      await search('users');
      expect(rows()).toEqual([]);
      expect(chip()).toEqual(['Failing 0']);
    });

    it('should clear the search and the chips together and empty the box', async () => {
      const { fixture, element, rows, text, search, queryFilter, queryFacets } = mount(entries());
      await fixture.whenStable();

      await search('users');
      queryFacets.set(new Set(['error']));
      await fixture.whenStable();

      expect(rows()).toEqual([]);

      element.querySelector<HTMLButtonElement>('[aria-label="Clear filters"]')?.click();
      await fixture.whenStable();

      expect(queryFilter()).toBe('');
      expect(queryFacets().size).toBe(0);
      expect(element.querySelector<HTMLInputElement>('.et-query-devtools-search')?.value).toBe('');
      expect(rows()).toHaveLength(5);
      expect(text('.et-query-devtools-count')).toBe('5');
      expect(element.querySelector('[aria-label="Clear filters"]')).toBeNull();
    });

    it('should narrow the path tree and its folder counts with the search', async () => {
      const { fixture, element, search } = mount(entries());
      TestBed.inject(QUERY_DEVTOOLS_HOST).queryTreeView.set(true);
      await fixture.whenStable();

      const folders = () =>
        [...element.querySelectorAll('.et-query-devtools-row--folder button')].map((folder) =>
          folder.getAttribute('title'),
        );

      expect(folders()).toContain('Collapse /posts - 2 queries below it');

      await search('42');
      expect(folders()).toEqual([]);
      expect(element.querySelectorAll('.et-query-devtools-row')).toHaveLength(1);

      await search('');
      expect(folders()).toContain('Collapse /posts - 2 queries below it');
    });

    it('should hide the selected query under a search that excludes it and bring it back on clearing', async () => {
      const { fixture, element, selectedQueryId, search } = mount(entries());
      selectedQueryId.set('c');
      await fixture.whenStable();

      await search('users');
      expect(element.querySelector('.et-query-devtools-row--active')).toBeNull();

      await search('');
      expect(
        element.querySelector('.et-query-devtools-row--active .et-query-devtools-route')?.textContent?.trim(),
      ).toBe('/posts');
    });
  });
});
