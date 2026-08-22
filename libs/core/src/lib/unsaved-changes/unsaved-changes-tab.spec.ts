import { Injector, runInInjectionContext, signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { createUnsavedChangesTabLock } from './unsaved-changes-tab';
import { createUnsavedChangesTracker, CreateUnsavedChangesTrackerConfig } from './unsaved-changes-tracker';

type BadgingNavigator = Omit<Navigator, 'setAppBadge' | 'clearAppBadge'> & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

const dispatchBeforeUnload = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);

  return event.defaultPrevented;
};

describe('unsaved-changes tab lock', () => {
  let injector: Injector;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    injector = TestBed.inject(Injector);
  });

  afterEach(() => {
    // Destroys the injector, which releases every lock created in the test (the app badge is a
    // module-level, app-wide surface, so a leaked holder would bleed into the next test).
    TestBed.resetTestingModule();
    document.title = '';
  });

  const makeLock = (config: Parameters<typeof createUnsavedChangesTabLock>[0]) =>
    runInInjectionContext(injector, () => createUnsavedChangesTabLock(config));

  const makeTracker = <T>(config: CreateUnsavedChangesTrackerConfig<T>) =>
    runInInjectionContext(injector, () => createUnsavedChangesTracker(config));

  describe('beforeunload lock', () => {
    it('prevents the unload only while there are changes', () => {
      const hasChanges = signal(false);
      makeLock({ hasChanges });
      TestBed.tick();

      expect(dispatchBeforeUnload()).toBe(false);

      hasChanges.set(true);
      TestBed.tick();
      expect(dispatchBeforeUnload()).toBe(true);

      hasChanges.set(false);
      TestBed.tick();
      expect(dispatchBeforeUnload()).toBe(false);
    });

    it('attaches the listener only while dirty, keeping a clean page bfcache eligible', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      const hasChanges = signal(false);

      makeLock({ hasChanges });
      TestBed.tick();

      expect(addSpy).not.toHaveBeenCalledWith('beforeunload', expect.anything());

      hasChanges.set(true);
      TestBed.tick();
      expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.anything());

      hasChanges.set(false);
      TestBed.tick();
      expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.anything());

      addSpy.mockRestore();
      removeSpy.mockRestore();
    });

    it('is released by destroy()', () => {
      const hasChanges = signal(true);
      const lock = makeLock({ hasChanges });
      TestBed.tick();

      expect(dispatchBeforeUnload()).toBe(true);

      lock.destroy();

      expect(dispatchBeforeUnload()).toBe(false);
    });

    it('stays released after destroy() even when the changes signal flips again', () => {
      const hasChanges = signal(false);
      const lock = makeLock({ hasChanges });
      TestBed.tick();

      lock.destroy();

      hasChanges.set(true);
      TestBed.tick();

      expect(dispatchBeforeUnload()).toBe(false);
    });

    it('can be turned off with lock: false', () => {
      makeLock({ hasChanges: signal(true), lock: false });
      TestBed.tick();

      expect(dispatchBeforeUnload()).toBe(false);
    });
  });

  describe('tracker integration', () => {
    it('locks the tab by default while the value differs from the baseline', () => {
      const value: WritableSignal<string> = signal('Ada');
      const tracker = makeTracker({ source: value, confirm: () => true });
      TestBed.tick();

      expect(dispatchBeforeUnload()).toBe(false);

      value.set('Grace');
      TestBed.tick();
      expect(dispatchBeforeUnload()).toBe(true);

      // Re-baselining after a save unlocks the tab again.
      tracker.refreshDefaultValue();
      TestBed.tick();
      expect(dispatchBeforeUnload()).toBe(false);
    });

    it('does not lock the tab with tab: false', () => {
      const value: WritableSignal<string> = signal('Ada');
      const tracker = makeTracker({ source: value, confirm: () => true, tab: false });
      TestBed.tick();

      value.set('Grace');
      TestBed.tick();

      expect(tracker.hasChanges()).toBe(true);
      expect(tracker.tab).toBeNull();
      expect(dispatchBeforeUnload()).toBe(false);
    });
  });

  describe('title marker', () => {
    it('prefixes the tab title while dirty and restores it when clean', () => {
      document.title = 'Editor';
      const hasChanges = signal(false);

      makeLock({ hasChanges, titleMarker: true });
      TestBed.tick();

      expect(document.title).toBe('Editor');

      hasChanges.set(true);
      TestBed.tick();
      expect(document.title).toBe('● Editor');

      hasChanges.set(false);
      TestBed.tick();
      expect(document.title).toBe('Editor');
    });

    it('accepts a custom marker and removes it on destroy', () => {
      document.title = 'Editor';
      const hasChanges = signal(true);

      const lock = makeLock({ hasChanges, titleMarker: '*' });
      TestBed.tick();

      expect(document.title).toBe('* Editor');

      lock.destroy();
      TestBed.tick();

      expect(document.title).toBe('Editor');
    });

    it('shows one marker when two locks are dirty at the same time', () => {
      document.title = 'Editor';
      const first = signal(true);
      const second = signal(true);

      makeLock({ hasChanges: first, titleMarker: true });
      const secondLock = makeLock({ hasChanges: second, titleMarker: true });
      TestBed.tick();

      expect(document.title).toBe('● Editor');

      secondLock.destroy();
      TestBed.tick();

      // The first lock is still dirty, so the marker stays.
      expect(document.title).toBe('● Editor');
    });
  });

  describe('flash', () => {
    const setVisibility = (state: 'visible' | 'hidden') =>
      Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });

    afterEach(() => {
      vi.useRealTimers();
      setVisibility('visible');
    });

    it('blinks the title marker while the tab is in the background', () => {
      vi.useFakeTimers();
      setVisibility('hidden');
      document.title = 'Editor';

      makeLock({ hasChanges: signal(true), flash: { interval: 1000 } });
      TestBed.tick();

      expect(document.title).toBe('● Editor');

      vi.advanceTimersByTime(1000);
      TestBed.tick();
      expect(document.title).toBe('Editor');

      vi.advanceTimersByTime(1000);
      TestBed.tick();
      expect(document.title).toBe('● Editor');
    });

    it('does not blink in the foreground, where it would only be noise', () => {
      vi.useFakeTimers();
      setVisibility('visible');
      document.title = 'Editor';

      makeLock({ hasChanges: signal(true), flash: true });
      TestBed.tick();

      expect(document.title).toBe('● Editor');

      vi.advanceTimersByTime(5000);
      TestBed.tick();
      expect(document.title).toBe('● Editor');
    });

    it('blinks in the foreground too with whenHidden: false', () => {
      vi.useFakeTimers();
      setVisibility('visible');
      document.title = 'Editor';

      makeLock({ hasChanges: signal(true), flash: { interval: 500, whenHidden: false } });
      TestBed.tick();

      vi.advanceTimersByTime(500);
      TestBed.tick();
      expect(document.title).toBe('Editor');
    });

    it('leaves the marker showing when the changes are saved mid-blink', () => {
      vi.useFakeTimers();
      setVisibility('hidden');
      document.title = 'Editor';
      const hasChanges = signal(true);

      makeLock({ hasChanges, titleMarker: true, flash: { interval: 1000 } });
      TestBed.tick();

      // Blink to the "hidden" half, then go clean - the marker must not be left stuck off.
      vi.advanceTimersByTime(1000);
      TestBed.tick();
      expect(document.title).toBe('Editor');

      hasChanges.set(false);
      TestBed.tick();
      expect(document.title).toBe('Editor');

      hasChanges.set(true);
      TestBed.tick();
      expect(document.title).toBe('● Editor');
    });
  });

  describe('app badge', () => {
    let setAppBadge: ReturnType<typeof vi.fn>;
    let clearAppBadge: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      setAppBadge = vi.fn(() => Promise.resolve());
      clearAppBadge = vi.fn(() => Promise.resolve());

      Object.defineProperty(navigator, 'setAppBadge', { value: setAppBadge, configurable: true });
      Object.defineProperty(navigator, 'clearAppBadge', { value: clearAppBadge, configurable: true });
    });

    afterEach(() => {
      delete (navigator as BadgingNavigator).setAppBadge;
      delete (navigator as BadgingNavigator).clearAppBadge;
    });

    it('sets a dot while dirty and clears it when clean', () => {
      const hasChanges = signal(false);
      makeLock({ hasChanges, badge: true });
      TestBed.tick();

      hasChanges.set(true);
      TestBed.tick();
      expect(setAppBadge).toHaveBeenCalledWith(undefined);

      hasChanges.set(false);
      TestBed.tick();
      expect(clearAppBadge).toHaveBeenCalled();
    });

    it('sums the counts of several dirty locks and clears once the last one is clean', () => {
      const first = signal(true);
      const second = signal(true);

      makeLock({ hasChanges: first, badge: 2 });
      makeLock({ hasChanges: second, badge: 3 });
      TestBed.tick();

      expect(setAppBadge).toHaveBeenLastCalledWith(5);

      first.set(false);
      TestBed.tick();
      expect(setAppBadge).toHaveBeenLastCalledWith(3);
      expect(clearAppBadge).not.toHaveBeenCalled();

      second.set(false);
      TestBed.tick();
      expect(clearAppBadge).toHaveBeenCalled();
    });

    it('is left alone without the badge option', () => {
      const hasChanges = signal(true);
      makeLock({ hasChanges });
      TestBed.tick();

      expect(setAppBadge).not.toHaveBeenCalled();
      expect(clearAppBadge).not.toHaveBeenCalled();
    });
  });
});
