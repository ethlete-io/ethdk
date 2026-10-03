import {
  APP_BASE_HREF,
  BrowserPlatformLocation,
  HashLocationStrategy,
  LocationStrategy,
  PlatformLocation,
} from '@angular/common';
import { Provider } from '@angular/core';
import { provideRouter } from '@angular/router';
import { injectRoute, injectUrl } from '../index';
import { useScenario } from './harness';

const useScenarioAt = (url: string, providers: Provider[] = []) => {
  const originalUrl = window.location.href;

  beforeEach(() => window.history.replaceState(null, '', url));
  afterEach(() => window.history.replaceState(null, '', originalUrl));

  return useScenario({
    providers: [provideRouter([]), { provide: PlatformLocation, useClass: BrowserPlatformLocation }, ...providers],
  });
};

describe('router initial url scenarios', () => {
  describe('under a base href', () => {
    const scenario = useScenarioAt('/de/teams?page=2#top', [{ provide: APP_BASE_HREF, useValue: '/de/' }]);

    it('reads the url before the first navigation without the base href', () => {
      const c = scenario().consumer();

      expect(c.run(() => injectUrl())()).toBe('/teams?page=2#top');
      expect(c.run(() => injectRoute())()).toBe('/teams');
    });
  });

  describe('under a hash location strategy', () => {
    const scenario = useScenarioAt('/#/teams?page=2', [{ provide: LocationStrategy, useClass: HashLocationStrategy }]);

    it('reads the url before the first navigation from the hash', () => {
      const c = scenario().consumer();

      expect(c.run(() => injectUrl())()).toBe('/teams?page=2');
      expect(c.run(() => injectRoute())()).toBe('/teams');
    });
  });

  describe('at the root', () => {
    const scenario = useScenarioAt('/?page=2');

    it('reads the root url before the first navigation with a leading slash', () => {
      expect(
        scenario()
          .consumer()
          .run(() => injectUrl())(),
      ).toBe('/?page=2');
    });
  });
});
