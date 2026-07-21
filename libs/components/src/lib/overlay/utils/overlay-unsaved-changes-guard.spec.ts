import { ApplicationRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FieldTree } from '@angular/forms/signals';
import '../../../test-helpers';
import { injectOverlayManager } from '../overlay-manager';
import { OverlayRef } from '../overlay-ref';
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

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

const microtask = () => Promise.resolve();

describe('createOverlayUnsavedChangesGuard', () => {
  const tick = () => TestBed.inject(ApplicationRef).tick();
  const paneCount = () => document.querySelectorAll('.et-overlay-runtime-pane').length;

  let ref: OverlayRef<GuardedOverlayComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    GuardedOverlayComponent.nextDismissSources = undefined;
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
});
