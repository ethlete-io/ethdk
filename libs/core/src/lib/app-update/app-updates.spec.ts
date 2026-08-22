import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUnsavedChangesTracker } from '../unsaved-changes';
import { AppUpdatesConfig, injectAppUpdates, provideAppUpdates } from './app-updates';

const RELOADED_AT_KEY = 'et-app-update-reloaded-at';

type MutableDocument = Omit<Document, 'defaultView'> & { defaultView?: Document['defaultView'] };

const reload = vi.fn();

// jsdom seals both `window.location` and its `reload`, so the stub goes on the seam the provider
// actually reaches through - `document.defaultView` - with everything else delegated to the real window.
const windowWithStubbedReload = new Proxy(window, {
  get: (target, property, receiver) => {
    if (property === 'location') {
      return { reload };
    }

    const value = Reflect.get(target, property, receiver);

    return typeof value === 'function' ? value.bind(target) : value;
  },
});

const dispatchStaleChunkRejection = () => {
  const event = new Event('unhandledrejection') as Event & { reason?: unknown };
  event.reason = new TypeError('Failed to fetch dynamically imported module: /chunk-A1B2C3.js');
  window.dispatchEvent(event);
};

const hasReloaded = () => sessionStorage.getItem(RELOADED_AT_KEY) !== null;

describe('provideAppUpdates', () => {
  let injector: Injector;

  const setup = (config?: Partial<AppUpdatesConfig>) => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), ...provideAppUpdates({ pollInterval: 0, ...config })],
    });
    injector = TestBed.inject(Injector);

    return runInInjectionContext(injector, () => injectAppUpdates());
  };

  const makeDirtyForm = () => {
    const source = signal('Ada');

    runInInjectionContext(injector, () => createUnsavedChangesTracker({ source, confirm: () => true }));
    TestBed.tick();

    source.set('Ada, edited');
    TestBed.tick();
  };

  beforeEach(() => {
    Object.defineProperty(document, 'defaultView', { configurable: true, get: () => windowWithStubbedReload });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    sessionStorage.removeItem(RELOADED_AT_KEY);
    reload.mockClear();
    vi.unstubAllGlobals();

    delete (document as MutableDocument).defaultView;
  });

  describe('when a lazy chunk fails to load', () => {
    it('reports the build as broken and reloads, because nothing would be lost', () => {
      const updates = setup();

      dispatchStaleChunkRejection();

      expect(updates.isRequired()).toBe(true);
      expect(reload).toHaveBeenCalledTimes(1);
      expect(hasReloaded()).toBe(true);
    });

    it('leaves the reload to the app while a tracked form is dirty', () => {
      const updates = setup();
      makeDirtyForm();

      dispatchStaleChunkRejection();

      expect(updates.isRequired()).toBe(true);
      expect(updates.wouldDiscardChanges()).toBe(true);
      expect(reload).not.toHaveBeenCalled();
    });

    it('only reports when autoReload is off', () => {
      const updates = setup({ autoReload: 'never' });

      dispatchStaleChunkRejection();

      expect(updates.isRequired()).toBe(true);
      expect(reload).not.toHaveBeenCalled();
    });

    it('does not reload twice inside the cooldown, so a broken deploy cannot loop', () => {
      sessionStorage.setItem(RELOADED_AT_KEY, String(Date.now()));

      const updates = setup({ reloadCooldown: 60_000 });

      dispatchStaleChunkRejection();

      expect(updates.isRequired()).toBe(true);
      expect(reload).not.toHaveBeenCalled();
    });

    it('reloads again once the cooldown has passed', () => {
      sessionStorage.setItem(RELOADED_AT_KEY, String(Date.now() - 120_000));

      setup({ reloadCooldown: 60_000 });

      dispatchStaleChunkRejection();

      expect(reload).toHaveBeenCalledTimes(1);
    });

    it('ignores an error that is not a chunk failure', () => {
      const updates = setup();

      const event = new Event('unhandledrejection') as Event & { reason?: unknown };
      event.reason = new Error('The API is having a bad day');
      window.dispatchEvent(event);

      expect(updates.isRequired()).toBe(false);
      expect(reload).not.toHaveBeenCalled();
    });
  });

  describe('reload()', () => {
    it('releases the unsaved-changes locks first, so the browser does not ask again', () => {
      const updates = setup();
      makeDirtyForm();

      expect(updates.wouldDiscardChanges()).toBe(true);

      updates.reload();
      TestBed.tick();

      expect(updates.wouldDiscardChanges()).toBe(false);
      expect(reload).toHaveBeenCalledTimes(1);
    });
  });

  describe('check()', () => {
    const respondWith = (html: string) =>
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.resolve(new Response(html))),
      );

    it('stays quiet when the deployed build is the one already running', async () => {
      const script = document.createElement('script');
      script.setAttribute('src', '/main-AAA.js');
      document.head.appendChild(script);

      const updates = setup();
      respondWith('<script src="/main-AAA.js"></script>');

      await updates.check();

      expect(updates.isAvailable()).toBe(false);

      script.remove();
    });

    it('reports an update once a different build is deployed', async () => {
      const script = document.createElement('script');
      script.setAttribute('src', '/main-AAA.js');
      document.head.appendChild(script);

      const updates = setup();
      respondWith('<script src="/main-BBB.js"></script>');

      await updates.check();

      expect(updates.isAvailable()).toBe(true);
      expect(updates.isRequired()).toBe(false);

      script.remove();
    });

    it('does not report an update when the check could not be answered', async () => {
      const script = document.createElement('script');
      script.setAttribute('src', '/main-AAA.js');
      document.head.appendChild(script);

      const updates = setup();
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
      );

      await updates.check();

      expect(updates.isAvailable()).toBe(false);

      script.remove();
    });
  });
});
