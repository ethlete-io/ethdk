import { Component, inject, input, inputBinding, signal, viewChild, viewChildren } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subscription } from 'rxjs';
import {
  ALERT_DIALOG_LABELS,
  createAlertDialogOpener,
  createOverlayOpener,
  createOverlaySingleSlot,
  createOverlayUnsavedChangesGuard,
  DEFAULT_ALERT_DIALOG_LABELS,
  defineOverlay,
  dialogOverlayStrategy,
  getClosestOverlay,
  injectAlertDialogLabels,
  injectOverlayManager,
  isTargetInsideOverlayTree,
  mergeOverlayConfigs,
  OVERLAY_BODY_TOKEN,
  OVERLAY_CONTENT_IMPORTS,
  OVERLAY_ERROR_CODES,
  OVERLAY_FOOTER_TOKEN,
  OVERLAY_HAS_BACKDROP,
  OVERLAY_HEADER_TOKEN,
  OVERLAY_MAIN_TOKEN,
  OVERLAY_REF,
  OverlayBodyComponent,
  OverlayCloseDirective,
  OverlayContainerComponent,
  OverlayFooterDirective,
  OverlayHeaderDirective,
  OverlayMainDirective,
  OverlayRef,
  OverlayTitleDirective,
  provideAlertDialogLabels,
  provideOverlay,
  provideOverlayManager,
  provideOverlayScrollBlocker,
  injectOverlayScrollBlocker,
  resolveClosestOverlay,
  resolveOverlayHasBackdrop,
} from '../index';
import { Scenario, useScenario } from './harness';

@Component({
  selector: 'et-scenario-rename-overlay',
  imports: [OVERLAY_CONTENT_IMPORTS],
  template: `
    <div etOverlayMain>
      <div etOverlayHeader><h2 et-overlay-title>Rename</h2></div>
      <div dividers="static" et-overlay-body><input [value]="name()" class="name" /></div>
      <div etOverlayFooter>
        <button class="cancel" etOverlayClose type="button">Cancel</button>
        <button class="confirm" etOverlayClose="renamed" type="button">Confirm</button>
      </div>
    </div>
  `,
})
class RenameOverlayComponent {
  name = input('');
  ref = inject(OVERLAY_REF);
  hasBackdrop = inject(OVERLAY_HAS_BACKDROP);
  container = inject(OverlayContainerComponent);
  title = viewChild.required(OverlayTitleDirective);
  closers = viewChildren(OverlayCloseDirective);
}

const renameOverlay = defineOverlay<RenameOverlayComponent, string>({
  component: RenameOverlayComponent,
  strategies: dialogOverlayStrategy({ maxWidth: '480px' }),
  autoFocus: '.name',
  panelClass: 'rename-pane',
});

@Component({
  selector: 'et-scenario-rename-page',
  template: `<button (click)="open()" class="open" type="button">Rename</button>`,
})
class RenamePageComponent {
  results = signal<(string | null)[]>([]);
  ref: OverlayRef<RenameOverlayComponent, string> | null = null;
  opener = createOverlayOpener(renameOverlay, {
    panelClass: 'opener-pane',
    afterClosed: (result) => this.results.update((list) => [...list, result]),
  });

  open() {
    this.ref = this.opener.open({ bindings: [inputBinding('name', () => 'draft')] });
  }
}

@Component({
  selector: 'et-scenario-regions-probe',
  template: 'probe',
})
class RegionsProbeComponent {
  main = inject(OVERLAY_MAIN_TOKEN);
  header = inject(OVERLAY_HEADER_TOKEN, { optional: true });
  body = inject(OVERLAY_BODY_TOKEN, { optional: true });
  footer = inject(OVERLAY_FOOTER_TOKEN, { optional: true });
}

@Component({
  selector: 'et-scenario-regions-overlay',
  imports: [
    OverlayMainDirective,
    OverlayHeaderDirective,
    OverlayBodyComponent,
    OverlayFooterDirective,
    RegionsProbeComponent,
  ],
  template: `
    <div etOverlayMain>
      <div etOverlayHeader><et-scenario-regions-probe /></div>
      <div et-overlay-body><et-scenario-regions-probe /></div>
      <div etOverlayFooter><et-scenario-regions-probe /></div>
    </div>
  `,
})
class RegionsOverlayComponent {
  probes = viewChildren(RegionsProbeComponent);
  main = viewChild.required(OverlayMainDirective);
  header = viewChild.required(OverlayHeaderDirective);
  body = viewChild.required(OverlayBodyComponent);
  footer = viewChild.required(OverlayFooterDirective);
}

@Component({
  selector: 'et-scenario-stray-body',
  imports: [OverlayBodyComponent],
  template: '<div et-overlay-body>stray</div>',
})
class StrayBodyComponent {}

@Component({
  selector: 'et-scenario-profile-overlay',
  template: `<input [value]="draft()" (input)="edit($event)" class="draft" />`,
})
class ProfileOverlayComponent {
  static confirms = 0;
  static answer = true;
  draft = signal('saved');

  edit(event: Event) {
    this.draft.set((event.target as HTMLInputElement).value);
  }

  guard = createOverlayUnsavedChangesGuard({
    source: this.draft,
    tab: false,
    confirm: () => {
      ProfileOverlayComponent.confirms++;

      return ProfileOverlayComponent.answer;
    },
  });
}

const profileOverlay = defineOverlay<ProfileOverlayComponent, string>({
  component: ProfileOverlayComponent,
  strategies: dialogOverlayStrategy(),
});

@Component({ selector: 'et-scenario-note-overlay', template: 'note' })
class NoteOverlayComponent {}

const noteOverlay = defineOverlay<NoteOverlayComponent>({
  component: NoteOverlayComponent,
  strategies: dialogOverlayStrategy(),
});

@Component({ selector: 'et-scenario-editor-page', template: '' })
class EditorPageComponent {
  slot = createOverlaySingleSlot();
  profile = createOverlayOpener(profileOverlay, { single: this.slot });
  note = createOverlayOpener(noteOverlay, { single: this.slot });
}

@Component({ selector: 'et-scenario-alerts-page', template: '' })
class AlertsPageComponent {
  dialogs = createAlertDialogOpener();
  labels = injectAlertDialogLabels();
}

@Component({
  selector: 'et-scenario-german-alerts-page',
  providers: [provideAlertDialogLabels({ cancel: 'Abbrechen' })],
  template: '',
})
class GermanAlertsPageComponent {
  dialogs = createAlertDialogOpener();
}

const elementsOf = (ref: { readonly elements: OverlayRef['elements'] }) => {
  const elements = ref.elements;

  if (!elements) throw new Error('overlay is not mounted');

  return elements;
};

const backdropOf = (ref: { readonly elements: OverlayRef['elements'] }) => {
  const backdrop = elementsOf(ref).backdropElement();

  if (!backdrop) throw new Error('overlay has no backdrop');

  return backdrop;
};

const query = <T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<T>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const pointerDown = (target: Element) =>
  target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));

const overlayRoots = () => document.querySelectorAll('.et-overlay-runtime-root').length;

const openRename = (s: Scenario) => {
  const fixture = TestBed.createComponent(RenamePageComponent);

  s.flush();

  const trigger = query<HTMLButtonElement>('.open', fixture.nativeElement);

  trigger.focus();
  trigger.click();
  s.flush();

  const ref = fixture.componentInstance.ref;

  if (!ref) throw new Error('rename overlay did not open');

  return { fixture, trigger, page: fixture.componentInstance, ref };
};

describe('overlay dialog scenarios', () => {
  let scrollHeight: { mockRestore: () => void } | null = null;

  const scenario = useScenario({
    providers: () => {
      // jsdom lays nothing out, so the document never looks scrollable and the lock would be skipped.
      scrollHeight = vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(2000);

      return [provideOverlay()];
    },
  });

  afterEach(() => {
    scrollHeight?.mockRestore();
    scrollHeight = null;
    document.documentElement.removeAttribute('style');
  });

  it('opens a dialog from an opener, moves focus in, closes with a result and returns focus', async () => {
    const s = scenario();
    const { page, ref, trigger } = openRename(s);

    await s.settle();
    const pane = elementsOf(ref).paneElement;

    expect(pane.classList).toContain('et-overlay--dialog');
    expect(pane.classList).toContain('rename-pane');
    expect(pane.classList).toContain('opener-pane');
    expect(pane.style.maxWidth).toContain('480px');
    expect(ref.componentInstance()?.name()).toBe('draft');
    expect(query<HTMLInputElement>('.name').value).toBe('draft');
    expect(document.activeElement).toBe(query('.name'));

    const entry = query('.et-overlay-runtime-entry');

    expect(entry.getAttribute('role')).toBe('dialog');
    expect(entry.getAttribute('aria-modal')).toBe('true');
    expect(entry.getAttribute('aria-labelledby')).toBe(query('h2').id);
    expect(ref.componentInstance()?.hasBackdrop()).toBe(true);
    expect(ref.componentInstance()?.container).toBeInstanceOf(OverlayContainerComponent);
    expect(ref.componentInstance()?.title()).toBeInstanceOf(OverlayTitleDirective);
    expect(ref.componentInstance()?.closers()).toHaveLength(2);
    expect(document.documentElement.style.position).toBe('fixed');

    query('.confirm').click();
    s.flush();

    expect(page.results()).toEqual(['renamed']);
    expect(document.activeElement).toBe(trigger);
    expect(overlayRoots()).toBe(0);
    expect(document.documentElement.style.position).toBe('');
    expect(s.run(() => injectOverlayManager().openOverlays())).toEqual([]);
  });

  it('closes on Escape and on a backdrop press, and reports each close source', () => {
    const s = scenario();
    const { page, ref } = openRename(s);
    const sources: string[] = [];

    ref.afterClosedEvent().subscribe((event) => sources.push(event.source));

    const escape = s.keydown('Escape');

    expect(escape.defaultPrevented).toBe(true);
    s.flush();
    expect(sources).toEqual(['escape']);
    expect(page.results()).toEqual([null]);

    page.open();
    s.flush();
    const reopened = page.ref;

    if (!reopened) throw new Error('not reopened');

    reopened.beforeClosedEvent().subscribe((event) => sources.push(`before:${event.source}`));
    pointerDown(backdropOf(reopened));
    s.flush();

    expect(sources).toEqual(['escape', 'before:outside-pointer']);
    expect(page.results()).toEqual([null, null]);
    expect(overlayRoots()).toBe(0);
  });

  it('keeps a disableClose dialog open on Escape and backdrop, and closes it through the api', () => {
    const s = scenario();
    const results: unknown[] = [];
    const ref = s.run(() =>
      injectOverlayManager().open<NoteOverlayComponent, string>(NoteOverlayComponent, {
        strategies: dialogOverlayStrategy(),
        disableClose: true,
        autoFocus: false,
      }),
    );

    ref.afterClosed().subscribe((result) => results.push(result));
    s.flush();

    s.keydown('Escape');
    pointerDown(backdropOf(ref));
    s.flush();
    expect(ref.componentInstance()).toBeInstanceOf(NoteOverlayComponent);

    ref.close('done');
    s.flush();
    expect(results).toEqual(['done']);
  });

  it('stacks a nested dialog above its parent and closes the topmost first on Escape', () => {
    const s = scenario();
    const { page, ref } = openRename(s);
    const nested = s.run(() =>
      injectOverlayManager().open<NoteOverlayComponent>(NoteOverlayComponent, {
        strategies: dialogOverlayStrategy(),
        origin: query('.confirm'),
      }),
    );

    s.flush();

    const manager = s.run(() => injectOverlayManager());

    expect(manager.openOverlays()).toEqual([ref, nested]);
    expect(
      isTargetInsideOverlayTree({
        target: elementsOf(nested).paneElement,
        rootPane: elementsOf(ref).paneElement,
        openOverlays: manager.openOverlays(),
      }),
    ).toBe(true);
    expect(getClosestOverlay({ nativeElement: query('.confirm') }, manager.openOverlays())).toBe(ref);
    expect(
      resolveClosestOverlay({
        overlayRef: null,
        element: { nativeElement: query('.confirm') },
        openOverlays: manager.openOverlays(),
      }),
    ).toBe(ref);

    s.keydown('Escape', document.body);
    s.flush();
    expect(manager.openOverlays()).toEqual([ref]);

    s.keydown('Escape', document.body);
    s.flush();
    expect(manager.openOverlays()).toEqual([]);
    expect(page.results()).toEqual([null]);
    expect(overlayRoots()).toBe(0);
  });

  it('keeps scroll unlocked for a non-modal overlay without a backdrop', () => {
    const s = scenario();

    s.run(() => injectOverlayScrollBlocker());

    const ref = s.run(() =>
      injectOverlayManager().open(NoteOverlayComponent, {
        mode: 'non-modal',
        hasBackdrop: false,
        autoFocus: false,
      }),
    );

    s.flush();
    expect(elementsOf(ref).backdropElement()).toBeNull();
    expect(document.documentElement.style.position).toBe('');
    expect(resolveOverlayHasBackdrop({ mode: 'non-modal' })).toBe(false);
    expect(resolveOverlayHasBackdrop({ mode: 'non-modal' }, { hasBackdrop: true })).toBe(true);
    expect(resolveOverlayHasBackdrop({ hasBackdrop: false }, { hasBackdrop: true })).toBe(false);

    ref.close();
    s.flush();
  });

  it('keeps an overlay manager and scroll blocker of its own below a consumer', () => {
    const s = scenario();
    const scoped = s.consumer([provideOverlayManager(), provideOverlayScrollBlocker()]);
    const rootManager = s.run(() => injectOverlayManager());
    const scopedManager = scoped.run(() => injectOverlayManager());

    scoped.run(() => injectOverlayScrollBlocker());

    const ref = scopedManager.open(NoteOverlayComponent, { strategies: dialogOverlayStrategy(), autoFocus: false });

    s.flush();
    expect(scopedManager).not.toBe(rootManager);
    expect(scopedManager.openOverlays()).toEqual([ref]);
    expect(rootManager.openOverlays()).toEqual([]);

    ref.close();
    s.flush();
    scoped.destroy();
  });

  it.fails('leaves <html> scroll-locked when an app is destroyed with a modal overlay open', async () => {
    const s = scenario();
    const app = await s.app([provideOverlay()]);

    app.run(() => injectOverlayManager()).open(NoteOverlayComponent, { strategies: dialogOverlayStrategy() });
    s.flush();
    expect(document.documentElement.style.position).toBe('fixed');

    app.destroy();
    s.flush();
    expect(overlayRoots()).toBe(0);
    expect(document.documentElement.style.position).toBe('');
  });

  it('provides the layout regions to content and rejects a body without a main', () => {
    const s = scenario();
    const ref = s.run(() =>
      injectOverlayManager().open(RegionsOverlayComponent, { strategies: dialogOverlayStrategy(), autoFocus: false }),
    );

    s.flush();

    const regions = ref.componentInstance();

    if (!regions) throw new Error('regions overlay did not mount');

    const [inHeader, inBody, inFooter] = regions.probes();

    expect(regions.probes().every((probe) => probe.main === regions.main())).toBe(true);
    expect([inHeader?.header, inHeader?.body]).toEqual([regions.header(), null]);
    expect([inBody?.body, inBody?.footer]).toEqual([regions.body(), null]);
    expect([inFooter?.footer, inFooter?.header]).toEqual([regions.footer(), null]);

    const pane = elementsOf(ref).paneElement;

    expect(query('.et-overlay-main', pane)).toBeTruthy();
    expect(query('.et-overlay-header', pane)).toBeTruthy();
    expect(query('.et-overlay-footer', pane)).toBeTruthy();
    expect(query('.et-overlay-body-container', pane)).toBeTruthy();

    ref.close();
    s.flush();

    const stray = TestBed.createComponent(StrayBodyComponent);

    expect(() => stray.detectChanges()).toThrow(`ET${OVERLAY_ERROR_CODES.MISSING_OVERLAY_MAIN}`);
    stray.destroy();
    s.flush();
  });

  it('asks the unsaved-changes guard before a dirty overlay closes and before a single slot replaces it', async () => {
    const s = scenario();
    const fixture = TestBed.createComponent(EditorPageComponent);

    ProfileOverlayComponent.confirms = 0;
    ProfileOverlayComponent.answer = false;
    s.flush();

    const ref = fixture.componentInstance.profile.open({ autoFocus: false });

    s.flush();

    const draft = query<HTMLInputElement>('.draft');

    draft.value = 'edited';
    draft.dispatchEvent(new Event('input'));
    s.flush();

    s.keydown('Escape');
    await s.settle();
    expect(ProfileOverlayComponent.confirms).toBe(1);
    expect(ref?.componentInstance()).toBeInstanceOf(ProfileOverlayComponent);

    expect(fixture.componentInstance.note.open({ autoFocus: false })).toBeNull();
    await s.settle();
    expect(ProfileOverlayComponent.confirms).toBe(2);
    expect(s.run(() => injectOverlayManager().openOverlays())).toEqual([ref]);

    ProfileOverlayComponent.answer = true;

    const note = fixture.componentInstance.note.open({ autoFocus: false });

    await s.settle();
    expect(note).toBeNull();
    expect(ProfileOverlayComponent.confirms).toBe(3);

    const [open] = s.run(() => injectOverlayManager().openOverlays());

    expect(open?.componentInstance()).toBeInstanceOf(NoteOverlayComponent);

    open?.close();
    s.flush();
    expect(overlayRoots()).toBe(0);
  });

  it('merges definition, opener and per-open configs additively', () => {
    scenario();

    const merged = mergeOverlayConfigs(
      { panelClass: 'base', role: 'dialog', ariaLabel: 'Base' },
      { panelClass: ['opener', 'base'], ariaLabel: undefined },
      { panelClass: 'call', ariaLabel: null },
    );

    expect(merged.panelClass).toEqual(['base', 'opener', 'call']);
    expect(merged.role).toBe('dialog');
    expect(merged.ariaLabel).toBeNull();
  });

  it('asks and answers a confirm dialog with localized labels, and closes it on unsubscribe', () => {
    const s = scenario();
    const perLocale = s.consumer([{ provide: ALERT_DIALOG_LABELS, useValue: () => ({ acknowledge: 'Verstanden' }) }]);
    const fixture = TestBed.createComponent(AlertsPageComponent);

    s.flush();
    expect(fixture.componentInstance.labels()).toEqual(DEFAULT_ALERT_DIALOG_LABELS);
    expect(perLocale.run(() => injectAlertDialogLabels())().acknowledge).toBe('Verstanden');

    const germanAnswers: boolean[] = [];

    TestBed.createComponent(GermanAlertsPageComponent)
      .componentInstance.dialogs.confirm({ title: 'Verwerfen?' })
      .subscribe((answer) => germanAnswers.push(answer));
    s.flush();
    expect(document.activeElement?.textContent?.trim()).toBe('Abbrechen');
    (document.activeElement as HTMLElement).click();
    s.flush();
    expect(germanAnswers).toEqual([false]);

    const answers: boolean[] = [];

    fixture.componentInstance.dialogs
      .confirm({ title: 'Delete project?', message: 'Gone for everyone.', confirmLabel: 'Delete project' })
      .subscribe((answer) => answers.push(answer));
    s.flush();

    const entry = query('.et-overlay-runtime-entry');

    expect(entry.getAttribute('role')).toBe('alertdialog');
    expect(query('.et-alert-dialog-title').textContent?.trim()).toBe('Delete project?');
    expect(entry.getAttribute('aria-describedby')).toBe(query('.et-alert-dialog-message').id);
    expect(document.activeElement?.textContent?.trim()).toBe(DEFAULT_ALERT_DIALOG_LABELS.cancel);

    pointerDown(query('.et-overlay-runtime-backdrop'));
    s.flush();
    expect(overlayRoots()).toBe(1);

    const confirm = Array.from(document.querySelectorAll<HTMLButtonElement>('.et-alert-dialog-actions button')).find(
      (button) => button.textContent?.trim() === 'Delete project',
    );

    confirm?.click();
    s.flush();
    expect(answers).toEqual([true]);
    expect(overlayRoots()).toBe(0);

    const acknowledged: string[] = [];

    fixture.componentInstance.dialogs.alert({ title: 'Export finished' }).subscribe({
      next: () => acknowledged.push('next'),
      complete: () => acknowledged.push('complete'),
    });
    s.flush();
    expect(document.activeElement?.textContent?.trim()).toBe(DEFAULT_ALERT_DIALOG_LABELS.acknowledge);
    s.keydown('Escape');
    s.flush();
    expect(acknowledged).toEqual(['next', 'complete']);

    const pending: Subscription = fixture.componentInstance.dialogs.confirm({ title: 'Leave?' }).subscribe(() => {
      throw new Error('an unsubscribed confirm must not answer');
    });

    s.flush();
    expect(overlayRoots()).toBe(1);
    pending.unsubscribe();
    s.flush();
    expect(overlayRoots()).toBe(0);
  });
});
