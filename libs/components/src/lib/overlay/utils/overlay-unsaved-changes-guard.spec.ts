import { ApplicationRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FieldTree } from '@angular/forms/signals';
import '../../../test-helpers';
import { injectOverlayManager } from '../overlay-manager';
import { OverlayRef } from '../overlay-ref';
import { OverlayRouter, injectOverlayRouter, provideOverlayRouter } from '../routing/overlay-router';
import { createOverlayUnsavedChangesGuard, OverlayUnsavedChangesGuardRef } from './overlay-unsaved-changes-guard';

type Model = { name: string };

@Component({ template: 'guarded overlay' })
class GuardedOverlayComponent {
  model = signal<Model>({ name: 'Ada' });
  form = form(this.model);

  confirmResult = signal(true);
  confirmCalls = 0;

  guard: OverlayUnsavedChangesGuardRef<Model> = createOverlayUnsavedChangesGuard<Model>({
    source: this.form as FieldTree<Model>,
    confirm: () => {
      this.confirmCalls++;

      return this.confirmResult();
    },
    dismissSources: this.dismissSources,
  });

  // overridden per-test via a provider-free static hook
  get dismissSources() {
    return GuardedOverlayComponent.nextDismissSources;
  }

  static nextDismissSources: Record<string, boolean> | undefined = undefined;
}

@Component({ template: 'page one' })
class RoutedPageOneComponent {}

@Component({ template: 'page two' })
class RoutedPageTwoComponent {}

@Component({ template: 'routed guarded overlay' })
class RoutedGuardedOverlayComponent {
  router: OverlayRouter = injectOverlayRouter();

  model = signal<Model>({ name: 'Ada' });
  form = form(this.model);

  confirmResult = signal(true);
  confirmCalls = 0;

  guard: OverlayUnsavedChangesGuardRef<Model> = createOverlayUnsavedChangesGuard<Model>({
    source: this.form as FieldTree<Model>,
    confirm: () => {
      this.confirmCalls++;

      return this.confirmResult();
    },
    guardRouteChanges: RoutedGuardedOverlayComponent.nextGuardRouteChanges,
  });

  static nextGuardRouteChanges: boolean | undefined = undefined;
}

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

const microtask = () => Promise.resolve();

/** A guard chain resolves over several microtasks, so a fixed number of them would be a flaky wait. */
const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('createOverlayUnsavedChangesGuard', () => {
  const tick = () => TestBed.inject(ApplicationRef).tick();
  const paneCount = () => document.querySelectorAll('.et-overlay-runtime-pane').length;

  let ref: OverlayRef<GuardedOverlayComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    GuardedOverlayComponent.nextDismissSources = undefined;
    RoutedGuardedOverlayComponent.nextGuardRouteChanges = undefined;
  });

  const open = async () => {
    const manager = TestBed.runInInjectionContext(() => injectOverlayManager());
    ref = manager.open<GuardedOverlayComponent>(GuardedOverlayComponent);
    await flushFrames();

    return ref.componentInstance() as GuardedOverlayComponent;
  };

  afterEach(async () => {
    ref?.forceClose();
    await flushFrames();
  });

  it('lets a clean close proceed without running confirm', async () => {
    const instance = await open();
    expect(paneCount()).toBe(1);

    ref.close();
    await flushFrames();

    expect(paneCount()).toBe(0);
    expect(instance.confirmCalls).toBe(0);
  });

  it('vetoes a dirty close, runs confirm, and closes when confirmed', async () => {
    const instance = await open();

    instance.form().value.set({ name: 'Grace' });
    tick();

    ref.close();
    await microtask();

    // still open right after the vetoed attempt
    expect(instance.confirmCalls).toBe(1);

    // confirm resolved truthy → the guard re-issues the close
    await flushFrames();
    expect(paneCount()).toBe(0);
  });

  it('keeps the overlay open when the user cancels the discard', async () => {
    const instance = await open();
    instance.confirmResult.set(false);

    instance.form().value.set({ name: 'Grace' });
    tick();

    ref.close();
    await flushFrames();

    expect(instance.confirmCalls).toBe(1);
    expect(paneCount()).toBe(1);
  });

  it('does not guard a source that is disabled in dismissSources', async () => {
    GuardedOverlayComponent.nextDismissSources = { closeCall: false };
    const instance = await open();

    instance.form().value.set({ name: 'Grace' });
    tick();

    // closeCall (api) is not guarded → dirty close proceeds without confirm
    ref.close();
    await flushFrames();

    expect(instance.confirmCalls).toBe(0);
    expect(paneCount()).toBe(0);
  });

  it('treats the form as clean again after refreshDefaultValue', async () => {
    const instance = await open();

    instance.form().value.set({ name: 'Grace' });
    tick();
    instance.guard.refreshDefaultValue();
    tick();

    ref.close();
    await flushFrames();

    expect(instance.confirmCalls).toBe(0);
    expect(paneCount()).toBe(0);
  });

  it('stops guarding after destroy()', async () => {
    const instance = await open();
    instance.guard.destroy();

    instance.form().value.set({ name: 'Grace' });
    tick();

    ref.close();
    await flushFrames();

    expect(instance.confirmCalls).toBe(0);
    expect(paneCount()).toBe(0);
  });

  describe('in a routed overlay', () => {
    let routedRef: OverlayRef<RoutedGuardedOverlayComponent>;

    const openRouted = async () => {
      const manager = TestBed.runInInjectionContext(() => injectOverlayManager());

      routedRef = manager.open<RoutedGuardedOverlayComponent>(RoutedGuardedOverlayComponent, {
        providers: [
          provideOverlayRouter({
            routes: [
              { path: '/', component: RoutedPageOneComponent },
              { path: '/two', component: RoutedPageTwoComponent },
            ],
          }),
        ],
      });

      await flushFrames();

      return routedRef.componentInstance() as RoutedGuardedOverlayComponent;
    };

    afterEach(async () => {
      routedRef?.forceClose();
      await flushFrames();
    });

    it('lets a clean navigation commit synchronously', async () => {
      const instance = await openRouted();

      instance.router.navigate('/two');

      expect(instance.router.currentPage()?.path).toBe('/two');
      expect(instance.confirmCalls).toBe(0);
    });

    it('vetoes a dirty navigation and commits it once the discard is confirmed', async () => {
      const instance = await openRouted();

      instance.form().value.set({ name: 'Grace' });
      tick();

      instance.router.navigate('/two');

      expect(instance.router.currentPage()?.path).toBe('/');

      await flushMicrotasks();
      tick();

      expect(instance.confirmCalls).toBe(1);
      expect(instance.router.currentPage()?.path).toBe('/two');
    });

    it('keeps the current route when the user cancels the discard', async () => {
      const instance = await openRouted();
      instance.confirmResult.set(false);

      instance.form().value.set({ name: 'Grace' });
      tick();

      instance.router.navigate('/two');
      await flushMicrotasks();
      tick();

      expect(instance.confirmCalls).toBe(1);
      expect(instance.router.currentPage()?.path).toBe('/');
    });

    it('leaves navigation alone when guardRouteChanges is false', async () => {
      RoutedGuardedOverlayComponent.nextGuardRouteChanges = false;
      const instance = await openRouted();

      instance.form().value.set({ name: 'Grace' });
      tick();

      instance.router.navigate('/two');

      expect(instance.confirmCalls).toBe(0);
      expect(instance.router.currentPage()?.path).toBe('/two');
    });
  });
});
