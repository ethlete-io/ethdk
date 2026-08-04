import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { createQueryClient, createQueryCreator, QueryClientRef, QueryRuntimeErrorCode } from '../../http';
import { QueryStateType } from '../query';
import { provideLegacyPrepareFallback } from './legacy-prepare-fallback';
import { createLegacyQueryCreator } from './legacy-query-creator';

describe('provideLegacyPrepareFallback', () => {
  let client: QueryClientRef;
  let httpTesting: HttpTestingController;

  const makeCreator = () =>
    createLegacyQueryCreator({
      name: 'legacyGetPerson',
      creator: createQueryCreator(undefined, { client, method: 'GET', route: '/person' }),
    });

  const configure = (...providers: unknown[]) => {
    client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'legacy-fallback-test' });
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ...providers] as never[],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  };

  it('lets prepare() work outside an injection context', () => {
    configure(provideLegacyPrepareFallback());

    const query = makeCreator().prepare({});

    query.execute();

    httpTesting.expectOne('https://api.example.com/person').flush({ id: 1 });
    expect(query.rawState.type).toBe(QueryStateType.Success);
  });

  it('still throws ET950 when it was not provided', () => {
    configure();

    expect(() => makeCreator().prepare({})).toThrowError(
      new RegExp(`ET${QueryRuntimeErrorCode.LEGACY_PREPARE_WITHOUT_INJECTION_CONTEXT}`),
    );
  });

  it('refuses to stash anything on the server', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {
      // silence the dev-mode hint
    });

    configure(provideLegacyPrepareFallback(), { provide: PLATFORM_ID, useValue: 'server' });

    // Touching the injector runs the environment initializer.
    TestBed.inject(HttpTestingController);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('does nothing on the server'));
    expect(() => makeCreator().prepare({})).toThrowError(
      new RegExp(`ET${QueryRuntimeErrorCode.LEGACY_PREPARE_WITHOUT_INJECTION_CONTEXT}`),
    );

    warn.mockRestore();
  });

  it('stops answering once the application injector is gone', () => {
    configure(provideLegacyPrepareFallback());
    TestBed.inject(HttpTestingController);
    TestBed.resetTestingModule();

    // A stale stash must not build a query that can never run.
    expect(() => makeCreator().prepare({})).toThrowError(
      new RegExp(`ET${QueryRuntimeErrorCode.LEGACY_PREPARE_WITHOUT_INJECTION_CONTEXT}`),
    );
  });
});
