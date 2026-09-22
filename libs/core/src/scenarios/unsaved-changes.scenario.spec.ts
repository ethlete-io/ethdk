import { Component, inject, Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FieldTree, form } from '@angular/forms/signals';
import { provideLocationMocks } from '@angular/common/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import {
  createUnsavedChangesGuard,
  createUnsavedChangesTracker,
  injectUnsavedChangesCoordinator,
  UnsavedChangesConfirmContext,
} from '../index';
import { Scenario, useScenario } from './harness';

type Model = { name: string };

type Confirm = (value: unknown, context: UnsavedChangesConfirmContext) => boolean | Promise<boolean>;

const harness: {
  answer: Confirm;
  confirms: unknown[];
  editor: EditorComponent | null;
  late: LateEditorComponent | null;
} = { answer: () => true, confirms: [], editor: null, late: null };

const confirm = (value: unknown, context: UnsavedChangesConfirmContext) => {
  harness.confirms.push(value);

  return harness.answer(value, context);
};

@Component({ selector: 'et-scenario-shell', imports: [RouterOutlet], template: '<router-outlet />' })
class ShellComponent {}

@Component({ selector: 'et-scenario-editor', template: '' })
class EditorComponent {
  model = signal<Model>({ name: 'Ada' });
  tree = form(this.model);
  guard = createUnsavedChangesGuard({
    source: this.tree,
    confirm,
    tab: { lock: true, titleMarker: true, badge: true },
  });

  constructor() {
    harness.editor = this;
  }
}

@Component({ selector: 'et-scenario-late-editor', template: '' })
class LateEditorComponent {
  injector = inject(Injector);
  tree = signal<FieldTree<Model> | null>(null);
  guard = createUnsavedChangesGuard({ source: this.tree, confirm });

  constructor() {
    harness.late = this;
  }

  load(value: Model) {
    this.tree.set(runInInjectionContext(this.injector, () => form(signal(value))));
  }
}

type Guarded = { guard: { canDeactivate: () => Promise<boolean> } };

const canDeactivate = (component: Guarded) => component.guard.canDeactivate();

const editor = () => {
  if (!harness.editor) throw new Error('editor not mounted');

  return harness.editor;
};

const deferred = () => {
  let resolve!: (value: boolean) => void;
  const promise = new Promise<boolean>((r) => (resolve = r));

  return { promise, resolve };
};

const isTabLocked = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);

  return event.defaultPrevented;
};

const badgeCalls: (number | undefined | 'clear')[] = [];

const installBadging = () => {
  Object.defineProperty(navigator, 'setAppBadge', {
    configurable: true,
    value: (contents?: number) => {
      badgeCalls.push(contents);

      return Promise.resolve();
    },
  });
  Object.defineProperty(navigator, 'clearAppBadge', {
    configurable: true,
    value: () => {
      badgeCalls.push('clear');

      return Promise.resolve();
    },
  });
};

const uninstallBadging = () => {
  const nav = navigator as unknown as Record<string, unknown>;

  delete nav['setAppBadge'];
  delete nav['clearAppBadge'];
};

describe('unsaved-changes scenarios', () => {
  beforeEach(() => {
    harness.answer = () => true;
    harness.confirms = [];
    harness.editor = null;
    harness.late = null;
    badgeCalls.length = 0;
    document.title = 'Editor';
    installBadging();
  });

  afterEach(() => {
    uninstallBadging();
    document.title = '';
  });

  const scenario = useScenario({
    providers: [
      provideRouter([
        { path: 'edit', component: EditorComponent, canDeactivate: [canDeactivate] },
        { path: 'late', component: LateEditorComponent, canDeactivate: [canDeactivate] },
        { path: 'other', children: [] },
      ]),
      provideLocationMocks(),
    ],
  });

  const boot = async (s: Scenario, url: string) => {
    const fixture = TestBed.createComponent(ShellComponent);
    const router = s.run(() => inject(Router));

    await navigate(s, url);

    return { fixture, router };
  };

  const navigate = async (s: Scenario, url: string) => {
    const navigation = s.run(() => inject(Router)).navigateByUrl(url);

    await s.settle();

    return navigation;
  };

  it('keeps the user on a dirty route when the confirm declines and leaves once it accepts', async () => {
    const s = scenario();
    const { fixture, router } = await boot(s, '/edit');

    expect(isTabLocked()).toBe(false);

    editor().model.set({ name: 'Grace' });
    s.tick();

    expect(isTabLocked()).toBe(true);
    expect(document.title).toBe('● Editor');

    harness.answer = () => false;

    await expect(navigate(s, '/other')).resolves.toBe(false);
    expect(router.url).toBe('/edit');
    expect(harness.confirms).toEqual([{ name: 'Grace' }]);

    harness.answer = () => true;

    await expect(navigate(s, '/other')).resolves.toBe(true);
    expect(router.url).toBe('/other');
    expect(harness.confirms).toHaveLength(2);
    expect(isTabLocked()).toBe(false);
    expect(document.title).toBe('Editor');

    fixture.destroy();
  });

  it('adopts the pending route confirm for a second check instead of asking twice', async () => {
    const s = scenario();
    const { fixture, router } = await boot(s, '/edit');
    const answer = deferred();
    const draft = signal('draft');
    const other = s.consumer().run(() => createUnsavedChangesTracker({ source: draft, confirm, tab: false }));

    draft.set('edited');
    editor().model.set({ name: 'Grace' });
    s.tick();

    harness.answer = () => answer.promise;

    const navigation = router.navigateByUrl('/other');

    await s.settle();

    const second = other.runCheck();

    expect(harness.confirms).toHaveLength(1);

    answer.resolve(true);

    await expect(navigation).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    expect(router.url).toBe('/other');
    expect(harness.confirms).toHaveLength(1);

    fixture.destroy();
  });

  it('lets a pending navigation through and aborts its confirm when the session is abandoned', async () => {
    const s = scenario();
    const { fixture, router } = await boot(s, '/edit');
    const aborted: unknown[] = [];

    editor().model.set({ name: 'Grace' });
    s.tick();

    harness.answer = (_value, { signal: abort }) => {
      abort.addEventListener('abort', () => aborted.push(abort.reason));

      return new Promise<boolean>(() => undefined);
    };

    const navigation = router.navigateByUrl('/other');

    await s.settle();
    expect(harness.confirms).toHaveLength(1);

    s.run(() => injectUnsavedChangesCoordinator()).abandonAll('logout');

    await expect(navigation).resolves.toBe(true);
    expect(router.url).toBe('/other');
    expect(aborted).toEqual(['logout']);
    expect(isTabLocked()).toBe(false);

    fixture.destroy();
  });

  it('sums the app badge across trackers and clears it with the last clean one', async () => {
    const s = scenario();
    const { fixture } = await boot(s, '/edit');
    const draft = signal('draft');
    const c = s.consumer();

    c.run(() => createUnsavedChangesTracker({ source: draft, confirm, tab: { lock: false, badge: 3 } }));
    s.tick();
    badgeCalls.length = 0;

    editor().model.set({ name: 'Grace' });
    draft.set('edited');
    s.tick();

    expect(badgeCalls.at(-1)).toBe(3);

    await navigate(s, '/other');

    expect(badgeCalls.at(-1)).toBe(3);

    draft.set('draft');
    s.tick();

    expect(badgeCalls.at(-1)).toBe('clear');

    c.destroy();
    fixture.destroy();
  });

  it('does not ask about a late form whose baseline has not been captured yet', async () => {
    const s = scenario();
    const { fixture, router } = await boot(s, '/late');
    const late = harness.late;

    harness.answer = () => false;
    late?.load({ name: 'Ada' });

    expect(late?.guard.defaultValue()).toBeNull();
    expect(late?.guard.hasChanges()).toBe(false);

    await expect(router.navigateByUrl('/other')).resolves.toBe(true);
    expect(harness.confirms).toEqual([]);

    fixture.destroy();
  });
});
