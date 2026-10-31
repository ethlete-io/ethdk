import { Component, input, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SelectDirective } from '@ethlete/components';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { Project, Themes } from '../../host/design';
import { resetDesignStreams } from '../../host/design-events';
import { THEMES } from '../../themes';
import { SystemViewComponent } from '../system-view/system-view.component';
import { NO_LIST_REVISIONS } from './list-revisions';
import { StudioViewComponent } from './studio-view.component';

@Component({ selector: 'ethlete-system-view', template: '' })
class SystemViewStubComponent {
  public port = input<number | null>(null);
  public epoch = input(0);
  public checkout = input('');
  public projectThemes = input<Record<string, Themes>>({});
  public lists = input(NO_LIST_REVISIONS);
}

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  private listeners = new Map<string, Set<(event: Event) => void>>();

  constructor() {
    FakeEventSource.instances.push(this);
  }

  addEventListener(name: string, listener: (event: Event) => void) {
    this.listeners.set(name, (this.listeners.get(name) ?? new Set()).add(listener));
  }

  removeEventListener(name: string, listener: (event: Event) => void) {
    this.listeners.get(name)?.delete(listener);
  }

  close() {
    return undefined;
  }

  emit(name: string, data = '{}') {
    this.listeners.get(name)?.forEach((listener) => listener(Object.assign(new Event(name), { data })));
  }
}

const CHECKOUT = '/checkout';

const PROJECT: Project = {
  callsRoot: `${CHECKOUT}/calls`,
  port: 4402,
  defaultCall: null,
  themes: {},
  calls: [],
};

const RUNNING = {
  port: 4402,
  listening: true,
  managed: false,
  foreign: false,
  stale: false,
  exited: false,
  log: [] as string[],
  logRevision: 0,
};

const sent: { command: string; args: unknown }[] = [];

const stubHost = (overrides: Record<string, () => unknown> = {}) => {
  const answers: Record<string, () => unknown> = {
    design_roots: () => ({ search: '', roots: [CHECKOUT] }),
    design_project: () => PROJECT,
    design_server_state: () => RUNNING,
    ...overrides,
  };
  let next = 1;

  Object.defineProperty(window, '__TAURI_INTERNALS__', {
    configurable: true,
    value: {
      invoke: (command: string, args: unknown) => {
        sent.push({ command, args });

        return command in answers ? Promise.resolve(answers[command]?.()) : new Promise(() => undefined);
      },
      transformCallback: () => next++,
      unregisterCallback: () => undefined,
    },
  });
};

const settle = async (fixture: ComponentFixture<StudioViewComponent>) => {
  for (let round = 0; round < 5; round++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
};

const element = (fixture: ComponentFixture<StudioViewComponent>) => fixture.nativeElement as HTMLElement;

const system = (fixture: ComponentFixture<StudioViewComponent>) =>
  fixture.debugElement.query(By.directive(SystemViewStubComponent))?.componentInstance as
    SystemViewStubComponent | undefined;

const button = (root: Element, text: string) =>
  [...root.querySelectorAll<HTMLButtonElement>('button')].find((found) => found.textContent?.trim() === text);

const status = (fixture: ComponentFixture<StudioViewComponent>) =>
  element(fixture).querySelector('footer')?.textContent ?? '';

const mount = async () => {
  localStorage.setItem('ethlete-studio.call-view', JSON.stringify({ checkout: CHECKOUT }));

  const fixture = TestBed.createComponent(StudioViewComponent);

  fixture.autoDetectChanges();
  await settle(fixture);

  return fixture;
};

describe('StudioViewComponent', () => {
  beforeEach(() => {
    sent.length = 0;
    localStorage.clear();
    FakeEventSource.instances = [];
    resetDesignStreams();
    vi.stubGlobal('EventSource', FakeEventSource);
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('[]', { status: 200 })));
    stubHost();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
    });
    TestBed.overrideComponent(StudioViewComponent, {
      remove: { imports: [SystemViewComponent] },
      add: { imports: [SystemViewStubComponent] },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
    vi.unstubAllGlobals();
  });

  it('hands the system view the port and themes of the checkout', async () => {
    const fixture = await mount();

    expect(system(fixture)?.port()).toBe(4402);
    expect(system(fixture)?.checkout()).toBe(CHECKOUT);
  });

  it('drops the port of the checkout before when the next one cannot be read', async () => {
    stubHost({ design_roots: () => ({ search: '', roots: [CHECKOUT, '/broken'] }) });

    const fixture = await mount();
    const picker = fixture.debugElement.query(By.directive(SelectDirective))?.injector.get(SelectDirective<string>);

    stubHost({
      design_roots: () => ({ search: '', roots: [CHECKOUT, '/broken'] }),
      design_project: () => Promise.reject('No design config in /broken.'),
    });

    picker?.value.set('/broken');
    await settle(fixture);

    expect(system(fixture)?.port()).toBeNull();
    expect(status(fixture)).toContain('No design config in /broken.');
  });

  it('opens the checkout picked last after a restart', async () => {
    stubHost({ design_roots: () => ({ search: '', roots: [CHECKOUT, '/other'] }) });

    const first = await mount();
    const picker = first.debugElement.query(By.directive(SelectDirective))?.injector.get(SelectDirective<string>);

    picker?.value.set('/other');
    await settle(first);
    first.destroy();

    const again = TestBed.createComponent(StudioViewComponent);

    again.autoDetectChanges();
    await settle(again);

    expect(system(again)?.checkout()).toBe('/other');
  });

  it('reads every list again on a reload', async () => {
    const fixture = await mount();

    button(element(fixture), 'Reload')?.click();
    await settle(fixture);

    expect(system(fixture)?.lists()).toEqual({ all: 1, products: 1, calls: 1, sketches: 1, flows: 1 });
  });

  it('reads only the list a design server event names, once per burst, and every list after a reconnect', async () => {
    const fixture = await mount();
    const stream = FakeEventSource.instances[0];
    const projectReads = () => sent.filter((call) => call.command === 'design_project').length;
    const settled = async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
      await settle(fixture);
    };

    stream?.emit('calls');
    stream?.emit('calls');
    await settled();

    expect(system(fixture)?.lists()).toEqual({ ...NO_LIST_REVISIONS, calls: 1 });

    const reads = projectReads();

    stream?.emit('sketches');
    await settled();

    expect(system(fixture)?.lists()).toEqual({ ...NO_LIST_REVISIONS, calls: 1, sketches: 1 });

    stream?.emit('error');
    stream?.emit('open');
    await settled();

    expect(system(fixture)?.lists()).toEqual({ all: 1, products: 1, calls: 2, sketches: 2, flows: 1 });
    expect(projectReads()).toBe(reads + 1);
  });

  it('offers Restart for a server Studio did not start and that runs an old cli', async () => {
    stubHost({
      design_server_state: () => ({ ...RUNNING, foreign: true, stale: true }),
      design_server_restart: () => ({ ...RUNNING, managed: true }),
    });

    const fixture = await mount();
    const footer = () => element(fixture).querySelector('footer') as HTMLElement;

    expect(status(fixture)).toContain('Design server 4402 · not started by Studio · stale');
    expect(button(footer(), 'Restart')).toBeDefined();

    button(footer(), 'Restart')?.click();
    await settle(fixture);

    expect(sent.some((call) => call.command === 'design_server_restart')).toBe(true);
    expect(status(fixture)).toContain('Design server 4402 · running');
    expect(button(footer(), 'Restart')).toBeUndefined();
  });

  it('says the design server stopped and shows its last output with a Restart', async () => {
    const stopped = () => ({
      ...RUNNING,
      listening: false,
      exited: true,
      log: ["Error: EMFILE: too many open files, watch '/x/calls'"],
    });

    stubHost({ design_server_state: stopped, design_server_start: stopped });

    const fixture = await mount();
    const panel = element(fixture).querySelector('[role="alert"]');

    expect(panel?.textContent).toContain('The design server stopped');
    expect(panel?.textContent).toContain('EMFILE: too many open files');
    expect(panel?.textContent).toContain('Raise fs.inotify.max_user_instances');
    expect(system(fixture)).toBeUndefined();

    if (panel) button(panel, 'Restart')?.click();
    await settle(fixture);

    expect(sent.some((call) => call.command === 'design_server_restart')).toBe(true);
  });

  it('shows no system view while the server starts and hands it the port once it answers', async () => {
    const down = { ...RUNNING, listening: false };
    let release: (state: typeof RUNNING) => void = () => undefined;

    stubHost({ design_server_state: () => down });

    const original = (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a: unknown) => unknown } })
      .__TAURI_INTERNALS__;
    const invoke = original.invoke;

    original.invoke = (command, args) =>
      command === 'design_server_start' ? new Promise((resolve) => (release = resolve)) : invoke(command, args);

    const fixture = await mount();

    expect(element(fixture).textContent).toContain('The design server is starting');
    expect(system(fixture)).toBeUndefined();

    release({ ...RUNNING, managed: true });
    await settle(fixture);

    expect(system(fixture)?.port()).toBe(4402);
  });

  it('says the design server starts until it answers, then that it runs', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });

    let answer: () => Promise<Response> = () => Promise.resolve(new Response('', { status: 500 }));

    vi.stubGlobal('fetch', () => answer());

    try {
      const fixture = TestBed.createComponent(StudioViewComponent);

      localStorage.setItem('ethlete-studio.call-view', JSON.stringify({ checkout: CHECKOUT }));
      fixture.autoDetectChanges();
      await vi.advanceTimersByTimeAsync(10);
      await fixture.whenStable();

      expect(status(fixture)).toContain('Design server 4402 · starting');
      expect(status(fixture)).not.toContain('running');
      expect(element(fixture).textContent).toContain('The design server is starting');
      expect(system(fixture)).toBeUndefined();

      answer = () => Promise.resolve(new Response('[]', { status: 200 }));
      await vi.advanceTimersByTimeAsync(1000);
      await fixture.whenStable();

      expect(status(fixture)).toContain('Design server 4402 · running');
      expect(system(fixture)?.port()).toBe(4402);
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts its own server and draws the frames again when a server Studio did not start ends', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });

    const foreign = { ...RUNNING, foreign: true };
    let current = foreign;

    stubHost({
      design_server_state: () => current,
      design_server_start: () => ({ ...foreign, managed: true, foreign: false }),
    });

    try {
      const fixture = await mount();
      const before = system(fixture)?.epoch();

      current = { ...foreign, listening: false, foreign: false };
      vi.advanceTimersByTime(3000);
      await settle(fixture);

      expect(sent.some((call) => call.command === 'design_server_start')).toBe(true);
      expect(system(fixture)?.epoch()).not.toEqual(before);
    } finally {
      vi.useRealTimers();
    }
  });
});
