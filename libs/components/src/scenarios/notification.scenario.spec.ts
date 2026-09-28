import { Component, computed, inject, Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ColorTheme, provideColorThemesWithTailwind4, ThemeSwatch } from '@ethlete/core';
import { Subject, throwError } from 'rxjs';
import {
  createNotificationPromiseFn,
  createNotificationRef,
  DEFAULT_NOTIFICATION_LABELS,
  DEFAULT_NOTIFICATION_MANAGER_CONFIG,
  DEFAULT_NOTIFICATION_STATUS_ICONS,
  injectNotificationLabels,
  injectNotificationManager,
  injectNotificationManagerConfig,
  NOTIFICATION_ACTION_SLOTS,
  NOTIFICATION_ERROR_CODES,
  NOTIFICATION_IMPORTS,
  NOTIFICATION_LABELS,
  NOTIFICATION_STACK_CONTEXT_TOKEN,
  NOTIFICATION_STACK_OVERLAY_LAYER,
  NOTIFICATION_STATUS,
  NotificationActionDirective,
  NotificationComponent,
  NotificationConfig,
  NotificationDirective,
  NotificationDismissDirective,
  NotificationItemDirective,
  NotificationManager,
  NotificationRef,
  NotificationStackDirective,
  NotificationSwipeToDismissDirective,
  provideNotificationLabels,
  provideNotificationManager,
  provideNotificationManagerConfig,
  provideNotificationManagerInstance,
  resolveNotificationStatusIcon,
  toNotificationContent,
} from '../index';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'primary', isDefault: true, primary: swatch('0 90 200') },
  { name: 'alert', type: 'error', primary: swatch('200 30 30') },
  { name: 'calm', primary: swatch('30 160 90') },
];

const code = (value: number) => `ET${value}`;

const drainMicrotasks = () => new Promise<void>((done) => setImmediate(done));

const takeErrorContext = (s: Scenario) => {
  s.tick(1);

  const index = s.errors.findIndex((entry) => entry.source === 'console.error' && typeof entry.error === 'object');

  return s.errors.splice(index, 1)[0]?.error as { element?: HTMLElement } | undefined;
};

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const stack = () => document.body.querySelector<HTMLElement>('et-notification-stack');
const toasts = () => Array.from(document.body.querySelectorAll<HTMLElement>('et-notification'));
const titles = () => toasts().map((toast) => text(toast.querySelector('.et-notification-title')));

const button = (root: Element | undefined, selector: string) => {
  const element = root?.querySelector<HTMLButtonElement>(selector);

  if (!element) throw new Error(`No ${selector}`);

  return element;
};

@Component({
  selector: 'et-scenario-notification-page',
  template: `<button (click)="save()" class="save" type="button">Save</button>`,
})
class SavePageComponent {
  manager = injectNotificationManager();
  config = injectNotificationManagerConfig();
  labels = injectNotificationLabels();

  save() {
    return this.manager.open({ status: NOTIFICATION_STATUS.SUCCESS, title: 'Saved', message: 'Team A was updated' });
  }
}

const mountPage = (s: Scenario) => {
  const fixture = TestBed.createComponent(SavePageComponent);

  s.tick();

  return fixture.componentInstance;
};

const render = (s: Scenario) => {
  s.tick();
  s.frame(2);
};

const settleLeave = (s: Scenario) => {
  s.tick();
  s.frame(4);
  s.tick(1000);
  s.frame(4);
};

const open = (s: Scenario, manager: NotificationManager, config: NotificationConfig) => {
  const ref = manager.open(config);

  render(s);

  return ref;
};

@Component({
  selector: 'et-scenario-custom-toast',
  imports: [NotificationDirective, NotificationActionDirective, NotificationDismissDirective],
  template: `
    @for (ref of refs(); track ref.id) {
      <div #toast="etNotification" [ref]="ref" class="custom-toast" etNotification>
        <strong>{{ toast.title() }}</strong>
        <span class="custom-status">{{ toast.isError() ? 'failed' : toast.isSuccess() ? 'done' : 'busy' }}</span>
        <button class="custom-retry" etNotificationAction type="button">{{ toast.action()?.label }}</button>
        <button [etNotificationAction]="secondary" class="custom-later" type="button">Later</button>
        <button class="custom-close" etNotificationDismiss type="button">x</button>
      </div>
    }
  `,
})
class CustomToastsComponent {
  secondary = NOTIFICATION_ACTION_SLOTS.SECONDARY;
  injector = inject(Injector);
  managerConfig = injectNotificationManagerConfig();
  refs = signal<NotificationRef[]>([]);

  open(config: NotificationConfig) {
    const ref = createNotificationRef(config, { managerConfig: this.managerConfig });

    this.refs.update((refs) => [...refs, ref]);

    return ref;
  }

  promise = createNotificationPromiseFn({ open: (config) => this.open(config), injector: this.injector });
}

@Component({
  selector: 'et-scenario-swipe-toast',
  imports: [NotificationDirective, NotificationSwipeToDismissDirective],
  template: `<div [ref]="ref" class="swipe-toast" etNotification etNotificationSwipeToDismiss>Swipe me</div>`,
})
class SwipeToastComponent {
  ref = createNotificationRef(
    { status: 'info', title: 'Swipe', duration: 3000 },
    {
      managerConfig: injectNotificationManagerConfig(),
    },
  );
}

@Component({
  selector: 'et-scenario-own-stack',
  imports: [NOTIFICATION_IMPORTS, NotificationStackDirective, NotificationItemDirective],
  providers: [
    {
      provide: NOTIFICATION_STACK_CONTEXT_TOKEN,
      useFactory: () => {
        const page = inject(OwnStackState);

        return { visibleNotifications: page.visible, position: 'top-start', captureBeforeState: null };
      },
    },
    { provide: NOTIFICATION_LABELS, useValue: { dismiss: 'Close' } },
  ],
  template: `
    <section #stack="etNotificationStack" class="own-stack" etNotificationStack>
      @for (ref of stack.displayRefs(); track ref.id) {
        <div [etNotificationItem]="ref"><et-notification [ref]="ref" /></div>
      }
    </section>
  `,
})
class OwnStackComponent {
  state = inject(OwnStackState);
}

class OwnStackState {
  config = DEFAULT_NOTIFICATION_MANAGER_CONFIG;
  refs = signal<NotificationRef[]>([]);
  visible = computed(() => this.refs().filter((ref) => !ref.entry().isDismissed));

  add(title: string) {
    this.refs.update((refs) => [
      ...refs,
      createNotificationRef({ status: 'info', title }, { managerConfig: this.config }),
    ]);
  }
}

@Component({
  selector: 'et-scenario-stray-action',
  imports: [NotificationActionDirective],
  template: `<button etNotificationAction type="button">Stray</button>`,
})
class StrayActionComponent {}

@Component({
  selector: 'et-scenario-stray-dismiss',
  imports: [NotificationDismissDirective],
  template: `<button etNotificationDismiss type="button">Stray</button>`,
})
class StrayDismissComponent {}

@Component({
  selector: 'et-scenario-stray-swipe',
  imports: [NotificationSwipeToDismissDirective],
  template: `<div etNotificationSwipeToDismiss>Stray</div>`,
})
class StraySwipeComponent {}

describe('notification scenarios', () => {
  const scenario = useScenario({
    providers: [
      provideColorThemesWithTailwind4(COLOR_THEMES),
      provideNotificationManager({ maxVisible: 2, position: 'top-end' }),
      provideNotificationLabels({ dismiss: 'Schließen' }),
      OwnStackState,
    ],
  });

  it('shows a success toast in a live stack above overlays and auto-dismisses it', () => {
    const s = scenario();
    const page = mountPage(s);

    expect(page.config.maxVisible).toBe(2);
    expect(page.config.defaultDuration).toEqual(DEFAULT_NOTIFICATION_MANAGER_CONFIG.defaultDuration);
    expect(stack()).toBeNull();

    document.querySelector<HTMLButtonElement>('.save')?.click();
    render(s);

    const host = stack();

    expect(host?.parentElement).toBe(document.body);
    expect(host?.hasAttribute('role')).toBe(false);
    expect(host?.hasAttribute('aria-live')).toBe(false);
    expect(host?.getAttribute('data-position')).toBe('top-end');
    expect(host?.getAttribute('data-et-overlay-layer')).toBe(`${NOTIFICATION_STACK_OVERLAY_LAYER}`);

    const [toast] = toasts();

    expect(toast?.getAttribute('role')).toBe('status');
    expect(toast?.getAttribute('data-status')).toBe('success');
    expect(toast?.querySelector('.et-notification-icon')?.classList).toContain(
      `et-icon--${DEFAULT_NOTIFICATION_STATUS_ICONS.success}`,
    );
    expect(text(toast?.querySelector('.et-notification-title'))).toBe('Saved');
    expect(text(toast?.querySelector('.et-notification-message'))).toBe('Team A was updated');
    expect(toast?.querySelector('.et-notification-dismiss-btn')?.getAttribute('aria-label')).toBe('Schließen');
    expect(page.labels().dismiss).toBe('Schließen');
    expect(DEFAULT_NOTIFICATION_LABELS.dismiss).toBe('Dismiss');

    s.tick(3999);
    expect(toasts()).toHaveLength(1);

    s.tick(1);
    settleLeave(s);

    expect(page.manager.notifications()).toEqual([]);
    expect(stack()).toBeNull();
  });

  it('keeps an error up as an alert until Escape or the dismiss button, and holds timers on hover and focus', () => {
    const s = scenario();
    const page = mountPage(s);
    const error = open(s, page.manager, { status: NOTIFICATION_STATUS.ERROR, title: 'Upload failed' });

    s.tick(60_000);

    const [alert] = toasts();

    expect(alert?.getAttribute('role')).toBe('alert');
    expect(error.entry().isDismissing).toBe(false);

    s.keydown('Escape', alert);
    expect(error.entry().isDismissing).toBe(true);
    expect(alert?.getAttribute('data-dismissing')).toBe('true');
    settleLeave(s);
    expect(error.entry().isDismissed).toBe(true);

    const info = open(s, page.manager, { status: NOTIFICATION_STATUS.INFO, title: 'Syncing', duration: 1000 });
    const [toast] = toasts();

    toast?.dispatchEvent(new MouseEvent('mouseenter'));
    s.tick(5000);
    expect(info.entry().isDismissing).toBe(false);

    toast?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    toast?.dispatchEvent(new MouseEvent('mouseleave'));
    s.tick(5000);
    expect(info.entry().isDismissing).toBe(false);

    toast?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    s.tick(999);
    expect(info.entry().isDismissing).toBe(false);
    s.tick(1);
    expect(info.entry().isDismissing).toBe(true);
    settleLeave(s);

    const manual = open(s, page.manager, { status: 'info', title: 'Manual' });

    button(toasts()[0], '.et-notification-dismiss-btn').click();
    expect(manual.entry().isDismissing).toBe(true);
    settleLeave(s);
    expect(stack()).toBeNull();
  });

  it('caps the stack at maxVisible, newest on top, and replaces a toast by id instead of stacking it', () => {
    const s = scenario();
    const page = mountPage(s);

    const first = open(s, page.manager, { status: 'loading', title: 'Team A' });
    open(s, page.manager, { status: 'loading', title: 'Team B' });

    expect(titles()).toEqual(['Team B', 'Team A']);
    expect(toasts()[0]?.querySelector('et-spinner')).not.toBeNull();

    open(s, page.manager, { status: 'loading', title: 'Team C' });

    expect(first.entry().isDismissing).toBe(true);
    settleLeave(s);
    expect(titles()).toEqual(['Team C', 'Team B']);

    const sync = open(s, page.manager, { id: 'sync', status: 'loading', title: 'Syncing 1 of 3', progress: 33 });
    const again = open(s, page.manager, { id: 'sync', status: 'loading', title: 'Syncing 2 of 3', progress: 66 });

    expect(again).toBe(sync);
    expect(sync.id).toBe('sync');
    settleLeave(s);
    expect(titles()).toEqual(['Syncing 2 of 3', 'Team C']);
    expect(toasts()[0]?.querySelector('et-progress-bar')).not.toBeNull();

    sync.update({ status: 'success', title: 'Synced', progress: undefined });
    render(s);
    expect(toasts()[0]?.getAttribute('data-status')).toBe('success');
    expect(toasts()[0]?.querySelector('et-progress-bar')).toBeNull();

    page.manager.dismissAll();
    settleLeave(s);
    expect(page.manager.visibleNotifications()).toEqual([]);
    expect(stack()).toBeNull();
  });

  it('runs primary and secondary actions, dismissing unless the action opts out', () => {
    const s = scenario();
    const page = mountPage(s);
    const calls: string[] = [];

    const ref = open(s, page.manager, {
      status: NOTIFICATION_STATUS.ERROR,
      title: 'Could not save Team A',
      action: { label: 'Retry', handler: () => calls.push('retry'), dismiss: false },
      secondaryAction: { label: 'Discard', handler: () => calls.push('discard') },
    });

    const [toast] = toasts();
    const actions = Array.from(toast?.querySelectorAll('.et-notification-footer button') ?? []).map(text);

    expect(actions).toEqual(['Retry', 'Discard']);

    button(toast, '.et-notification-footer button').click();
    expect(calls).toEqual(['retry']);
    expect(ref.entry().isDismissing).toBe(false);

    button(toast, '.et-notification-secondary-action').click();
    expect(calls).toEqual(['retry', 'discard']);
    expect(ref.entry().isDismissing).toBe(true);
    settleLeave(s);
  });

  it('follows a promise and an observable, updating one toast in place', async () => {
    const s = scenario();
    const page = mountPage(s);

    let resolve: (value: { name: string }) => void = () => undefined;
    const saving = new Promise<{ name: string }>((done) => (resolve = done));

    const ref = page.manager.promise(saving, {
      loading: 'Saving Team A…',
      success: (team) => ({ title: 'Saved', message: team.name }),
      error: 'Could not save',
    });

    render(s);
    expect(titles()).toEqual(['Saving Team A…']);
    expect(toasts()[0]?.getAttribute('data-status')).toBe('loading');

    resolve({ name: 'Team A' });
    await drainMicrotasks();
    render(s);

    expect(page.manager.notifications()).toEqual([ref]);
    expect(toasts()[0]?.getAttribute('data-status')).toBe('success');
    expect(text(toasts()[0]?.querySelector('.et-notification-message'))).toBe('Team A');

    ref.dismiss();
    settleLeave(s);

    const failing = page.manager.promise(
      throwError(() => new Error('offline')),
      {
        loading: { title: 'Deleting Team B' },
        success: 'Deleted',
        error: (error) => ({ title: 'Delete failed', message: (error as Error).message }),
      },
    );

    render(s);
    expect(failing.entry().config.status).toBe('error');
    expect(toasts()[0]?.getAttribute('role')).toBe('alert');
    expect(text(toasts()[0]?.querySelector('.et-notification-message'))).toBe('offline');

    failing.dismiss();
    settleLeave(s);
  });

  it('builds a custom toast from the headless directives, with its own promise fn and swipe', async () => {
    const s = scenario();
    const fixture = TestBed.createComponent(CustomToastsComponent);
    const host = fixture.nativeElement as HTMLElement;
    const calls: string[] = [];
    const upload = new Subject<number>();

    s.tick();

    const ref = fixture.componentInstance.promise(upload, {
      loading: 'Uploading team-a.csv',
      success: (rows) => ({
        title: `Imported ${rows} rows`,
        action: { label: 'Open', handler: () => calls.push('open') },
        secondaryAction: { label: 'Later', handler: () => calls.push('later'), dismiss: false },
      }),
      error: 'Import failed',
    });

    render(s);
    expect(text(host.querySelector('.custom-status'))).toBe('busy');
    expect(host.querySelector('.custom-toast')?.getAttribute('data-status')).toBe('loading');

    upload.next(12);
    upload.complete();
    render(s);

    expect(text(host.querySelector('strong'))).toBe('Imported 12 rows');
    expect(text(host.querySelector('.custom-status'))).toBe('done');
    expect(text(host.querySelector('.custom-retry'))).toBe('Open');

    button(host, '.custom-later').click();
    expect(calls).toEqual(['later']);
    expect(ref.entry().isDismissing).toBe(false);

    button(host, '.custom-retry').click();
    expect(calls).toEqual(['later', 'open']);
    expect(ref.entry().isDismissing).toBe(true);
    s.tick();
    expect(ref.entry().isDismissed).toBe(true);

    const second = fixture.componentInstance.open({ status: 'info', title: 'Team B joined' });

    render(s);
    button(host.querySelectorAll('.custom-toast')[1], '.custom-close').click();
    s.tick();
    expect(second.entry().isDismissed).toBe(true);
  });

  it('swipes a notification away with a flick and keeps its timer held while the finger is down', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SwipeToastComponent);
    const toast = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.swipe-toast');
    const { ref } = fixture.componentInstance;

    s.tick();

    if (!toast) throw new Error('No toast');

    toast.setPointerCapture = () => undefined;

    expect(toast.style.touchAction).toBe('pan-y');

    const pointer = { pointerId: 1, isPrimary: true, pointerType: 'touch', button: 0, bubbles: true };

    toast.dispatchEvent(new PointerEvent('pointerdown', { ...pointer, clientX: 0, clientY: 0 }));
    s.tick(10_000);
    expect(ref.entry().isDismissing).toBe(false);

    document.dispatchEvent(new PointerEvent('pointermove', { ...pointer, clientX: 12, clientY: 0 }));
    s.tick(16);
    document.dispatchEvent(new PointerEvent('pointermove', { ...pointer, clientX: 40, clientY: 0 }));
    s.tick();
    expect(toast.style.transform).toMatch(/^translateX\(\d+px\)$/);

    document.dispatchEvent(new PointerEvent('pointerup', { ...pointer, clientX: 40, clientY: 0 }));
    s.tick();

    expect(toast.hasAttribute('data-swiped-away')).toBe(true);
    expect(ref.entry().isDismissed).toBe(true);
  });

  it('renders an app-owned stack with the default toast, top stacks newest first', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(OwnStackComponent);
    const host = fixture.nativeElement as HTMLElement;
    const { state } = fixture.componentInstance;

    state.add('Team A');
    state.add('Team B');
    render(s);

    const section = host.querySelector('.own-stack');

    expect(section?.getAttribute('data-position')).toBe('top-start');
    expect(section?.getAttribute('data-et-overlay-layer')).toBe(`${NOTIFICATION_STACK_OVERLAY_LAYER}`);
    expect(Array.from(host.querySelectorAll('[data-notification-id]')).map(text)).toEqual(['Team B', 'Team A']);
    expect(host.querySelector('.et-notification-dismiss-btn')?.getAttribute('aria-label')).toBe('Close');
    expect(host.querySelectorAll(`et-notification`)).toHaveLength(2);
    expect(fixture.debugElement.query((el) => el.componentInstance instanceof NotificationComponent)).not.toBeNull();

    button(host, '.et-notification-dismiss-btn').click();
    settleLeave(s);
    expect(Array.from(host.querySelectorAll('[data-notification-id]')).map(text)).toEqual(['Team A']);

    state.refs().forEach((ref) => ref.dismiss());
    settleLeave(s);
  });

  it('colours toasts per status and resolves status icons from a scoped manager config', () => {
    const s = scenario();
    const scoped = s.consumer([
      ...provideNotificationManagerConfig({
        statusColorMapping: { error: 'alert', success: 'calm' },
        controlsColor: 'calm',
        statusIcons: { info: 'et-times', error: null },
        swipeToDismiss: false,
      }),
      ...provideNotificationManagerInstance(),
    ]);
    const manager = scoped.run(() => injectNotificationManager());
    const config = scoped.run(() => injectNotificationManagerConfig());

    expect(manager).not.toBe(s.run(() => injectNotificationManager()));
    expect(resolveNotificationStatusIcon(config, 'info')).toBe('et-times');
    expect(resolveNotificationStatusIcon(config, 'error')).toBeNull();
    expect(resolveNotificationStatusIcon(config, 'success')).toBe(DEFAULT_NOTIFICATION_STATUS_ICONS.success);
    expect(toNotificationContent('Saved')).toEqual({ title: 'Saved' });
    expect(toNotificationContent({ title: 'Saved', message: 'Team A' })).toEqual({ title: 'Saved', message: 'Team A' });

    open(s, manager, { status: 'error', title: 'Failed' });

    const [toast] = toasts();

    expect(toast?.classList).toContain('et-color--alert');
    expect(toast?.querySelector('.et-notification-icon')).toBeNull();
    expect(toast?.querySelector('.et-notification-dismiss-btn')?.className).toContain('et-color--calm');
    expect(toast?.style.touchAction).toBe('');

    open(s, manager, { status: 'info', title: 'Heads up', icon: DEFAULT_NOTIFICATION_STATUS_ICONS.error });
    expect(toasts()[1]?.querySelector('.et-notification-icon')?.classList).toContain(
      `et-icon--${DEFAULT_NOTIFICATION_STATUS_ICONS.error}`,
    );

    manager.dismissAll();
    settleLeave(s);
    scoped.destroy();
  });

  it('reports headless parts placed outside a notification', () => {
    const s = scenario();

    const strayAction = TestBed.createComponent(StrayActionComponent);
    s.tick();
    s.expectError(code(NOTIFICATION_ERROR_CODES.ACTION_OUTSIDE_NOTIFICATION));
    expect(strayAction.nativeElement.contains(takeErrorContext(s)?.element)).toBe(true);

    const strayDismiss = TestBed.createComponent(StrayDismissComponent);
    s.tick();
    s.expectError(code(NOTIFICATION_ERROR_CODES.DISMISS_OUTSIDE_NOTIFICATION));
    expect(strayDismiss.nativeElement.contains(takeErrorContext(s)?.element)).toBe(true);

    const straySwipe = TestBed.createComponent(StraySwipeComponent);
    s.tick();
    s.expectError(code(NOTIFICATION_ERROR_CODES.SWIPE_OUTSIDE_NOTIFICATION));
    expect(straySwipe.nativeElement.contains(takeErrorContext(s)?.element)).toBe(true);
  });
});
