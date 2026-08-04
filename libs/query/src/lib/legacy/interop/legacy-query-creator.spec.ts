import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, createEnvironmentInjector, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createQueryClient, createQueryCreator, QueryClientRef, QueryRuntimeErrorCode } from '../../http';
import { QueryStateType } from '../query';
import { createLegacyQueryCreator } from './legacy-query-creator';

describe('LegacyQueryCreator.prepare', () => {
  let client: QueryClientRef;
  let httpTesting: HttpTestingController;

  const makeCreator = () =>
    createLegacyQueryCreator({
      name: 'legacyGetPerson',
      creator: createQueryCreator(undefined, { client, method: 'GET', route: '/person' }),
    });

  beforeEach(() => {
    client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'legacy-test' });
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  it('prepares a working query inside an injection context', () => {
    const query = TestBed.runInInjectionContext(() => makeCreator().prepare({}));

    query.execute();

    httpTesting.expectOne('https://api.example.com/person').flush({ id: 1 });
    expect(query.rawState.type).toBe(QueryStateType.Success);
  });

  it('calls onSuccess for a mutation answered with 204 no content', async () => {
    const creator = createLegacyQueryCreator({
      name: 'legacyPostReport',
      creator: createQueryCreator(undefined, { client, method: 'POST', route: '/report' }),
    });

    const query = TestBed.runInInjectionContext(() => creator.prepare({}));

    query.execute();

    let onSuccessCalls = 0;
    query.onSuccess(() => onSuccessCalls++);

    httpTesting.expectOne('https://api.example.com/report').flush(null, { status: 204, statusText: 'No Content' });
    await TestBed.inject(ApplicationRef).whenStable();

    expect(query.rawState.type).toBe(QueryStateType.Success);
    expect(onSuccessCalls).toBe(1);
  });

  it('throws a named error instead of NG0203 when called without an injection context', () => {
    const creator = makeCreator();

    expect(() => creator.prepare({})).toThrowError(
      new RegExp(`ET${QueryRuntimeErrorCode.LEGACY_PREPARE_WITHOUT_INJECTION_CONTEXT}.*legacyGetPerson`, 's'),
    );
  });

  describe('with a destroyed injector', () => {
    let injector: EnvironmentInjector;

    beforeEach(() => {
      injector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
      injector.destroy();
    });

    it('returns an inert query rather than throwing NG0205', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {
        // silence the dev-mode hint
      });

      const query = makeCreator().prepare({ injector });

      expect(query.rawState.type).toBe(QueryStateType.Prepared);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('legacyGetPerson'));

      warn.mockRestore();
    });

    it('does nothing when the inert query is used', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {
        // silence the dev-mode hint
      });

      const query = makeCreator().prepare({ injector });

      expect(() => {
        query.execute();
        query.abort();
        query.poll({ interval: 10 });
        query.stopPolling();
        query.destroy();
      }).not.toThrow();

      expect(query.isPolling).toBe(false);
      httpTesting.verify();

      vi.mocked(console.warn).mockRestore();
    });

    it('completes its state stream immediately', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {
        // silence the dev-mode hint
      });

      const states = await new Promise<unknown[]>((resolve) => {
        const seen: unknown[] = [];
        makeCreator()
          .prepare({ injector })
          .state$.subscribe({ next: (state) => seen.push(state), complete: () => resolve(seen) });
      });

      expect(states).toHaveLength(1);
      expect(states[0]).toMatchObject({ type: QueryStateType.Prepared });

      vi.mocked(console.warn).mockRestore();
    });
  });
});
