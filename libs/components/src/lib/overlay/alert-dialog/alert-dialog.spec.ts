import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import { Subscription, firstValueFrom } from 'rxjs';
import '../../../test-helpers';
import { TEST_COLOR_THEMES } from '../../testing/color-themes';
import { defineOverlay } from '../overlay-definition';
import { injectOverlayManager } from '../overlay-manager';
import { createOverlayOpener } from '../overlay-opener';
import { dialogOverlayStrategy } from '../strategies';
import { createOverlayUnsavedChangesGuard } from '../utils/overlay-unsaved-changes-guard';
import { provideAlertDialogLabels } from './alert-dialog-labels';
import { createAlertDialogOpener } from './alert-dialog-opener';

@Component({ template: '' })
class HostComponent {
  public dialogs = createAlertDialogOpener();
}

@Component({ template: 'editor', host: { class: 'guarded-editor' } })
class GuardedEditorComponent {
  private dialogs = createAlertDialogOpener();

  public value = signal('clean');

  public guard = createOverlayUnsavedChangesGuard({
    source: this.value,
    tab: false,
    confirm: () => this.dialogs.confirm({ title: 'Discard changes?', confirmLabel: 'Discard' }),
  });
}

const guardedEditorOverlay = defineOverlay<GuardedEditorComponent>({
  component: GuardedEditorComponent,
  strategies: dialogOverlayStrategy(),
});

@Component({ template: '' })
class GuardedEditorHostComponent {
  public editor = createOverlayOpener(guardedEditorOverlay);
}

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

const settle = async () => {
  TestBed.tick();
  await flushFrames();
  TestBed.tick();
  await flushFrames();
};

const waitForOpened = async () => {
  const [ref] = TestBed.runInInjectionContext(() => injectOverlayManager().openOverlays());

  if (!ref) throw new Error('No overlay is open.');

  await firstValueFrom(ref.afterOpened());
};

const openOverlayCount = () => TestBed.runInInjectionContext(() => injectOverlayManager().openOverlays().length);
const dialogHost = () => document.querySelector<HTMLElement>('[role="alertdialog"]');
const buttons = () => [...document.querySelectorAll<HTMLButtonElement>('.et-alert-dialog button')];
const buttonNamed = (name: string) => buttons().find((button) => button.textContent?.trim() === name);

describe('createAlertDialogOpener', () => {
  let host: HostComponent;
  let results: unknown[];
  let completed: boolean;
  let subscription: Subscription | null;

  const record = () => ({
    next: (value: unknown) => results.push(value),
    complete: () => (completed = true),
  });

  const setup = (providers: unknown[] = []) => {
    TestBed.configureTestingModule({ providers: [provideColorThemes([...TEST_COLOR_THEMES]), providers] });

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    host = fixture.componentInstance;
  };

  beforeEach(() => {
    results = [];
    completed = false;
    subscription = null;
  });

  afterEach(async () => {
    subscription?.unsubscribe();
    TestBed.runInInjectionContext(() => injectOverlayManager())
      .openOverlays()
      .forEach((ref) => ref.forceClose());
    await flushFrames();
  });

  it('opens nothing until subscribed', async () => {
    setup();

    host.dialogs.confirm({ title: 'Delete?' });
    await settle();

    expect(openOverlayCount()).toBe(0);
  });

  it('emits true and completes when the confirm action is pressed', async () => {
    setup();

    subscription = host.dialogs.confirm({ title: 'Delete?' }).subscribe(record());
    await settle();

    buttonNamed('Confirm')?.click();
    await settle();

    expect(results).toEqual([true]);
    expect(completed).toBe(true);
    expect(openOverlayCount()).toBe(0);
  });

  it('emits false when the cancel action is pressed', async () => {
    setup();

    subscription = host.dialogs.confirm({ title: 'Delete?' }).subscribe(record());
    await settle();

    buttonNamed('Cancel')?.click();
    await settle();

    expect(results).toEqual([false]);
    expect(completed).toBe(true);
  });

  it('emits false on Escape', async () => {
    setup();

    subscription = host.dialogs.confirm({ title: 'Delete?' }).subscribe(record());
    await settle();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();

    expect(results).toEqual([false]);
    expect(openOverlayCount()).toBe(0);
  });

  it('stays open on a press outside the dialog', async () => {
    setup();

    subscription = host.dialogs.confirm({ title: 'Delete?' }).subscribe(record());
    await settle();

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();

    expect(openOverlayCount()).toBe(1);
    expect(results).toEqual([]);
  });

  it('closes the dialog when the subscriber unsubscribes before an answer', async () => {
    setup();

    subscription = host.dialogs.confirm({ title: 'Delete?' }).subscribe(record());
    await settle();

    expect(openOverlayCount()).toBe(1);

    subscription.unsubscribe();
    await settle();

    expect(openOverlayCount()).toBe(0);
    expect(results).toEqual([]);
  });

  it('opens one dialog per subscription', async () => {
    setup();

    const confirm$ = host.dialogs.confirm({ title: 'Delete?' });
    const first = confirm$.subscribe();
    const second = confirm$.subscribe();
    await settle();

    expect(openOverlayCount()).toBe(2);

    first.unsubscribe();
    second.unsubscribe();
  });

  it('names the dialog by its title and describes it by its message', async () => {
    setup();

    subscription = host.dialogs.confirm({ title: 'Delete project?', message: 'This cannot be undone.' }).subscribe();
    await settle();

    const dialog = dialogHost();
    const labelledBy = dialog?.getAttribute('aria-labelledby') ?? '';
    const describedBy = dialog?.getAttribute('aria-describedby') ?? '';

    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(labelledBy)?.textContent?.trim()).toBe('Delete project?');
    expect(document.getElementById(describedBy)?.textContent?.trim()).toBe('This cannot be undone.');
  });

  it('sets no description when there is no message', async () => {
    setup();

    subscription = host.dialogs.confirm({ title: 'Delete?' }).subscribe();
    await settle();

    expect(dialogHost()?.hasAttribute('aria-describedby')).toBe(false);
  });

  it('focuses the cancel action of a confirm, even when it is destructive', async () => {
    setup();

    subscription = host.dialogs.confirm({ title: 'Delete?', destructive: true }).subscribe();
    await waitForOpened();

    expect(document.activeElement).toBe(buttonNamed('Cancel'));
  });

  it('renders a destructive confirm action in the error theme and a plain one without it', async () => {
    setup();

    subscription = host.dialogs.confirm({ title: 'Delete?', confirmLabel: 'Delete', destructive: true }).subscribe();
    await settle();

    expect(buttonNamed('Delete')?.classList).toContain('et-color--red');

    subscription.unsubscribe();
    await settle();

    subscription = host.dialogs.confirm({ title: 'Save?', confirmLabel: 'Save' }).subscribe();
    await settle();

    expect(buttonNamed('Save')?.classList).not.toContain('et-color--red');
  });

  it('takes its action labels from the provided labels, overridable per call', async () => {
    setup([provideAlertDialogLabels({ confirm: 'Bestätigen', cancel: 'Abbrechen' })]);

    subscription = host.dialogs.confirm({ title: 'Löschen?' }).subscribe();
    await settle();

    expect(buttons().map((button) => button.textContent?.trim())).toEqual(['Abbrechen', 'Bestätigen']);

    subscription.unsubscribe();
    await settle();

    subscription = host.dialogs.confirm({ title: 'Löschen?', confirmLabel: 'Löschen' }).subscribe();
    await settle();

    expect(buttons().map((button) => button.textContent?.trim())).toEqual(['Abbrechen', 'Löschen']);
  });

  it('alert emits once when acknowledged and focuses its only action', async () => {
    setup();

    subscription = host.dialogs.alert({ title: 'Saved' }).subscribe(record());
    await waitForOpened();

    expect(buttons().map((button) => button.textContent?.trim())).toEqual(['OK']);
    expect(document.activeElement).toBe(buttonNamed('OK'));

    buttonNamed('OK')?.click();
    await settle();

    expect(results).toEqual([undefined]);
    expect(completed).toBe(true);
  });

  it('alert emits once when dismissed with Escape', async () => {
    setup();

    subscription = host.dialogs.alert({ title: 'Saved', acknowledgeLabel: 'Got it' }).subscribe(record());
    await settle();

    expect(buttonNamed('Got it')).toBeDefined();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();

    expect(results).toEqual([undefined]);
    expect(completed).toBe(true);
  });

  it('answers an unsaved-changes guard: discarding closes the guarded overlay', async () => {
    TestBed.configureTestingModule({ providers: [provideColorThemes([...TEST_COLOR_THEMES])] });

    const fixture = TestBed.createComponent(GuardedEditorHostComponent);
    fixture.detectChanges();

    const editor = fixture.componentInstance.editor.open();
    await settle();

    editor.componentInstance()?.value.set('dirty');
    TestBed.tick();

    editor.close();
    await settle();

    expect(dialogHost()).not.toBeNull();
    expect(document.querySelector('.guarded-editor')).not.toBeNull();

    buttonNamed('Discard')?.click();
    await settle();
    await settle();

    expect(openOverlayCount()).toBe(0);
  });
});
