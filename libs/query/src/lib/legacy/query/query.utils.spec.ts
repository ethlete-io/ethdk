import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { V2QueryClient } from '../query-client';
import { QueryStateType } from './query.types';
import { createQueryCollectionSubject, switchQueryCollectionState, switchQueryState } from './query.utils';
const client = new V2QueryClient({
  baseRoute: 'https://jsonplaceholder.typicode.com',
});

const postsQuery = client.get({
  route: '/posts',
});

const posts2Query = client.get({
  route: '/posts',
});

let injector: Injector;

beforeEach(() => {
  TestBed.configureTestingModule({});

  injector = TestBed.inject(Injector);
});

describe('switchQueryCollectionState', () => {
  it('should switch to the query state observable and return the query state', (done) => {
    runInInjectionContext(injector, async () => {
      const collection = createQueryCollectionSubject({ mediaWithDetailsQuery: postsQuery, mediaQuery: posts2Query });
      collection.next({ type: 'mediaQuery', query: posts2Query.prepare() });

      const result$ = switchQueryCollectionState()(collection);

      const result = await firstValueFrom(result$);

      expect(result).toEqual({ meta: { id: 0, triggeredVia: 'program' }, type: QueryStateType.Prepared });
    });
  });

  it('should return null if the query state observable is null', (done) => {
    runInInjectionContext(injector, async () => {
      const collection = createQueryCollectionSubject({ mediaWithDetailsQuery: postsQuery, mediaQuery: posts2Query });

      const result$ = switchQueryCollectionState()(collection);

      const result = await firstValueFrom(result$);

      expect(result).toBeNull();
    });
  });
});

describe('switchQueryState', () => {
  it('should switch to the query state observable and return the query state', async (done) => {
    const query = posts2Query.prepare();

    const result$ = switchQueryState()(of(query));

    const result = await firstValueFrom(result$);
    expect(result).toEqual({ meta: { id: 0, triggeredVia: 'program' }, type: QueryStateType.Prepared });
  });

  it('should return null if the query state observable is null', async (done) => {
    const result$ = switchQueryState()(of(null));

    const result = await firstValueFrom(result$);

    expect(result).toBeNull();
  });
});
