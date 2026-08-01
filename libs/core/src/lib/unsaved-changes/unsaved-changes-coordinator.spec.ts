import {
  createEnvironmentInjector,
  EnvironmentInjector,
  Injector,
  runInInjectionContext,
  signal,
  WritableSignal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { injectUnsavedChangesCoordinator, UnsavedChangesConfirmContext } from './unsaved-changes-coordinator';
import { createUnsavedChangesTracker, CreateUnsavedChangesTrackerConfig } from './unsaved-changes-tracker';

type Deferred = {
  promise: Promise<boolean>;
  resolve: (result: boolean) => void;
};

const defer = (): Deferred => {
  let resolve!: (result: boolean) => void;
  const promise = new Promise<boolean>((res) => (resolve = res));

  return { promise, resolve };
};

const dispatchBeforeUnload = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);

  return event.defaultPrevented;
};

describe('unsaved-changes coordinator', () => {
  let injector: Injector;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    injector = TestBed.inject(Injector);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  const makeTracker = <T>(config: CreateUnsavedChangesTrackerConfig<T>, customInjector: Injector = injector) =>
    runInInjectionContext(customInjector, () => createUnsavedChangesTracker(config));

  const coordinator = () => runInInjectionContext(injector, () => injectUnsavedChangesCoordinator());

  const makeDirtyTracker = (confirm: CreateUnsavedChangesTrackerConfig<string>['confirm'], value = 'Ada') => {
    const source: WritableSignal<string> = signal(value);
    const tracker = makeTracker({ source, confirm });
    TestBed.tick();

    source.set(`${value} edited`);
    TestBed.tick();

    return tracker;
  };

  describe('one confirm at a time', () => {
    it('adopts the pending decision instead of opening a second dialog', async () => {
      const firstDialog = defer();
      const firstConfirm = vi.fn(() => firstDialog.promise);
      const secondConfirm = vi.fn(() => true);

      const first = makeDirtyTracker(firstConfirm);
      const second = makeDirtyTracker(secondConfirm, 'Grace');

      const firstCheck = first.runCheck();
      const secondCheck = second.runCheck();

      expect(firstConfirm).toHaveBeenCalledTimes(1);
      expect(secondConfirm).not.toHaveBeenCalled();

      firstDialog.resolve(true);

      await expect(firstCheck).resolves.toBe(true);
      await expect(secondCheck).resolves.toBe(true);
    });

    it('runs a fresh confirm once the previous one settled', async () => {
      const confirm = vi.fn(() => true);
      const tracker = makeDirtyTracker(confirm);

      await expect(tracker.runCheck()).resolves.toBe(true);
      await expect(tracker.runCheck()).resolves.toBe(true);

      expect(confirm).toHaveBeenCalledTimes(2);
    });

    it('tracks whether a confirm is on screen', async () => {
      const dialog = defer();
      const tracker = makeDirtyTracker(() => dialog.promise);
      const unsavedChanges = coordinator();

      expect(unsavedChanges.isCheckPending()).toBe(false);

      const check = tracker.runCheck();
      expect(unsavedChanges.isCheckPending()).toBe(true);

      dialog.resolve(false);
      await check;

      expect(unsavedChanges.isCheckPending()).toBe(false);
    });
  });

  describe('abandonAll', () => {
    it('resolves the pending check and aborts the confirm so its dialog can close', async () => {
      const dialog = defer();
      let abortReason: unknown = null;

      const tracker = makeDirtyTracker((_, context: UnsavedChangesConfirmContext) => {
        context.signal.addEventListener('abort', () => {
          abortReason = context.signal.reason;
          dialog.resolve(false); // what a real dialog does: close itself
        });

        return dialog.promise;
      });

      const check = tracker.runCheck();

      coordinator().abandonAll('logout');

      // The discard is allowed, so whatever waited on the check proceeds instead of hanging.
      await expect(check).resolves.toBe(true);
      expect(abortReason).toBe('logout');
      expect(tracker.isAbandoned()).toBe(true);
    });

    it('lets later checks pass without confirming', async () => {
      const confirm = vi.fn(() => false);
      const tracker = makeDirtyTracker(confirm);

      coordinator().abandonAll('logout');

      await expect(tracker.runCheck()).resolves.toBe(true);
      expect(confirm).not.toHaveBeenCalled();
      // The changes are still there - they just aren't guarded anymore.
      expect(tracker.hasChanges()).toBe(true);
    });

    it('releases the tab lock', () => {
      const tracker = makeDirtyTracker(() => true);

      expect(dispatchBeforeUnload()).toBe(true);

      coordinator().abandonAll('logout');
      TestBed.tick();

      expect(dispatchBeforeUnload()).toBe(false);
      expect(tracker.isAbandoned()).toBe(true);
    });

    it('does not affect trackers created afterwards (a new session guards again)', async () => {
      makeDirtyTracker(() => false);
      coordinator().abandonAll('logout');

      const confirm = vi.fn(() => false);
      const afterLogin = makeDirtyTracker(confirm);

      await expect(afterLogin.runCheck()).resolves.toBe(false);
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(afterLogin.isAbandoned()).toBe(false);
      expect(dispatchBeforeUnload()).toBe(true);
    });

    it('ignores trackers whose injector was destroyed', async () => {
      const child = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
      const source: WritableSignal<string> = signal('Ada');
      const tracker = makeTracker({ source, confirm: () => false }, child);
      TestBed.tick();

      source.set('Grace');
      TestBed.tick();

      child.destroy();

      // Destroying the injector already released the guard; abandoning must not resurrect or throw.
      expect(() => coordinator().abandonAll('logout')).not.toThrow();
      expect(tracker.isAbandoned()).toBe(false);
      await expect(tracker.runCheck()).resolves.toBe(false);
    });
  });
});
