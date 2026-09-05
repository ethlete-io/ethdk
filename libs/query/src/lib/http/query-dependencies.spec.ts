import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { isQueryDevtoolsEnabled } from '../devtools/query-devtools-hook';
import { provideQueryDevtools, queryDevtoolsEntries } from '../devtools/query-devtools-registry';
import { createQuery } from './query';
import { createQueryClient } from './query-client';
import { setupQueryDependencies } from './query-dependencies';

describe('setupQueryDependencies', () => {
  const client = createQueryClient({ baseUrl: 'https://example.com', name: 'test' });

  let hostElement: HTMLElement;
  let elementRefResolutions: number;

  const configure = (extraProviders: unknown[] = []) => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ElementRef,
          useFactory: () => {
            elementRefResolutions++;

            return new ElementRef(hostElement);
          },
        },
        ...extraProviders,
      ],
    });
  };

  const makeQuery = () =>
    TestBed.runInInjectionContext(() =>
      createQuery({
        creatorInternals: { client, method: 'GET', route: '/test' },
        features: [],
        queryConfig: {},
      }),
    );

  beforeEach(() => {
    hostElement = document.createElement('div');
    elementRefResolutions = 0;
  });

  describe('without the devtools', () => {
    beforeEach(() => configure());

    it('should create', () => {
      TestBed.runInInjectionContext(() => {
        const deps = setupQueryDependencies({ client, queryConfig: {} });

        expect(deps).toBeTruthy();
      });
    });

    it('should not resolve the host element while the devtools are off', () => {
      expect(isQueryDevtoolsEnabled()).toBe(false);

      makeQuery();
      TestBed.inject(HttpTestingController).expectOne('https://example.com/test').flush({});

      expect(elementRefResolutions).toBe(0);
    });

    it('should still report the host element when something reads it', () => {
      TestBed.runInInjectionContext(() => {
        const deps = setupQueryDependencies({ client, queryConfig: {} });

        expect(deps.hostElement).toBe(hostElement);
      });
    });
  });

  describe('with the devtools', () => {
    beforeEach(() => configure([provideQueryDevtools()]));

    it('should hand the host element to the devtools entry', () => {
      const query = makeQuery();

      expect(isQueryDevtoolsEnabled()).toBe(true);

      TestBed.inject(HttpTestingController).expectOne('https://example.com/test').flush({});

      const entry = queryDevtoolsEntries().find((e) => e.handle === query);

      expect(entry?.meta?.element).toBe(hostElement);
    });
  });
});
