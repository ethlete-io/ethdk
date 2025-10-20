import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
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
    runInInjectionContext(injector, () => {
      const collection = createQueryCollectionSubject({ mediaWithDetailsQuery: postsQuery, mediaQuery: posts2Query });
      collection.next({ type: 'mediaQuery', query: posts2Query.prepare() });

      const result$ = switchQueryCollectionState()(collection);

      result$.subscribe((result) => {
        expect(result).toEqual({ meta: { id: 0, triggeredVia: 'program' }, type: QueryStateType.Prepared });

        done();
      });
    });
  });

  it('should return null if the query state observable is null', (done) => {
    runInInjectionContext(injector, () => {
      const collection = createQueryCollectionSubject({ mediaWithDetailsQuery: postsQuery, mediaQuery: posts2Query });

      const result$ = switchQueryCollectionState()(collection);

      result$.subscribe((result) => {
        expect(result).toBeNull();

        done();
      });
    });
  });
});

describe('switchQueryState', () => {
  it('should switch to the query state observable and return the query state', (done) => {
    const query = posts2Query.prepare();

    const result$ = switchQueryState()(of(query));

    result$.subscribe((result) => {
      expect(result).toEqual({ meta: { id: 0, triggeredVia: 'program' }, type: QueryStateType.Prepared });

      done();
    });
  });

  it('should return null if the query state observable is null', (done) => {
    const result$ = switchQueryState()(of(null));

    result$.subscribe((result) => {
      expect(result).toBeNull();

      done();
    });
  });
});

// describe('takeUntilResponse', () => {
//   it('should complete the observable when a successful response is received', (done) => {
//     const query = postsQuery.prepare().execute();

//     query.state$.pipe(takeUntilResponse()).subscribe({
//       complete: () => {
//         done();
//       },
//     });
//   });
// });
