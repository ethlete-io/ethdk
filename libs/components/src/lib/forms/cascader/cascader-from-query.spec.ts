import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { createGetQuery, createQueryClient } from '@ethlete/query';
import { Observable, firstValueFrom, isObservable } from 'rxjs';
import '../../../test-helpers';
import { silenceExpectedConsole } from '../../testing/expected-console';
import { cascaderFromQuery } from './cascader-from-query';
import { CascaderNode } from './headless';

type ChildrenArgs = {
  response: { items: { id: string; name: string; leaf: boolean }[] };
  queryParams: { parent: string };
};

type SearchArgs = {
  response: { matches: { id: string; name: string }[][] };
  queryParams: { q: string };
};

describe('cascaderFromQuery', () => {
  let http: HttpTestingController;
  let client: ReturnType<typeof createQueryClient>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'cascader-test' });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  const createSource = (overrides?: {
    searchDebounce?: number;
    argsFor?: (parent: CascaderNode<string> | null) => { queryParams: { parent: string } } | null;
  }) =>
    TestBed.runInInjectionContext(() => {
      const getChildren = createGetQuery(client)<ChildrenArgs>('/children');
      const searchNodes = createGetQuery(client)<SearchArgs>('/search');

      return cascaderFromQuery({
        queryCreator: getChildren,
        args: overrides?.argsFor ?? ((parent) => ({ queryParams: { parent: parent?.value ?? 'root' } })),
        toNodes: (response) => response.items.map((item) => ({ value: item.id, label: item.name, isLeaf: item.leaf })),
        search: {
          queryCreator: searchNodes,
          args: (query) => ({ queryParams: { q: query } }),
          toResults: (response) =>
            response.matches.map((path) => path.map((node) => ({ value: node.id, label: node.name }))),
          debounceTime: overrides?.searchDebounce ?? 0,
        },
      });
    });

  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('loads a level through the query, mapping the response to nodes', async () => {
    const source = createSource();

    const result = firstValueFrom(source.loadChildren(null) as Observable<CascaderNode<string>[]>);

    TestBed.tick();
    await settle();

    const request = http.expectOne((req) => req.url.includes('/children') && req.url.includes('parent=root'));

    request.flush({ items: [{ id: 'euro', name: 'Euro', leaf: false }] });

    expect(await result).toEqual([{ value: 'euro', label: 'Euro', isLeaf: false }]);
  });

  it('builds the args from the parent node', async () => {
    const source = createSource();
    const parent: CascaderNode<string> = { value: 'euro', label: 'Euro' };

    const result = firstValueFrom(source.loadChildren(parent) as Observable<CascaderNode<string>[]>);

    TestBed.tick();
    await settle();

    const request = http.expectOne((req) => req.url.includes('parent=euro'));

    request.flush({ items: [{ id: 'euro-final', name: 'Final', leaf: true }] });

    expect(await result).toEqual([{ value: 'euro-final', label: 'Final', isLeaf: true }]);
  });

  it('skips the request when args returns null', () => {
    const source = createSource({ argsFor: () => null });

    expect(source.loadChildren(null)).toEqual([]);
    http.expectNone(() => true);
  });

  it('errors with the response message on failure', async () => {
    silenceExpectedConsole('error');

    const source = createSource();

    const result = firstValueFrom(source.loadChildren(null) as Observable<CascaderNode<string>[]>);

    TestBed.tick();
    await settle();

    http
      .expectOne((req) => req.url.includes('/children'))
      .flush({ message: 'Load failed' }, { status: 500, statusText: 'Server Error' });

    await expect(result).rejects.toThrow('Load failed');
  });

  it('cancels the request when the load is unsubscribed', async () => {
    const source = createSource();

    const subscription = (source.loadChildren(null) as Observable<CascaderNode<string>[]>).subscribe({
      error: () => {
        // the destroyed query surfaces a cancellation - irrelevant here
      },
    });

    TestBed.tick();
    await settle();

    const request = http.expectOne((req) => req.url.includes('/children'));

    subscription.unsubscribe();
    await settle();

    expect(request.cancelled).toBe(true);
  });

  it('searches through the search query, mapping matches to path chains', async () => {
    const source = createSource();

    const result = firstValueFrom(source.search!('finals') as Observable<CascaderNode<string>[][]>);

    // the (zero) debounce timer has to elapse before the request fires
    await settle();
    TestBed.tick();
    await settle();

    const request = http.expectOne((req) => req.url.includes('/search') && req.url.includes('q=finals'));

    request.flush({
      matches: [
        [
          { id: 'euro', name: 'Euro' },
          { id: 'euro-final', name: 'Final' },
        ],
      ],
    });

    expect(await result).toEqual([
      [
        { value: 'euro', label: 'Euro' },
        { value: 'euro-final', label: 'Final' },
      ],
    ]);
  });

  it('skips searches below the minimum query length', () => {
    const source = TestBed.runInInjectionContext(() => {
      const getChildren = createGetQuery(client)<ChildrenArgs>('/children');
      const searchNodes = createGetQuery(client)<SearchArgs>('/search');

      return cascaderFromQuery({
        queryCreator: getChildren,
        args: (parent) => ({ queryParams: { parent: parent?.value ?? 'root' } }),
        toNodes: (response) => response.items.map((item) => ({ value: item.id, label: item.name })),
        search: {
          queryCreator: searchNodes,
          args: (query) => ({ queryParams: { q: query } }),
          toResults: () => [],
          minQueryLength: 3,
        },
      });
    });

    expect(source.search!('ab')).toEqual([]);
    expect(isObservable(source.search!('abc'))).toBe(true);
    http.expectNone(() => true);
  });
});
