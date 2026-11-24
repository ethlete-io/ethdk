import { Component, input, output, provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { DesignServerCrash, Project, Themes } from '../../host/design';
import { resetDesignStreams } from '../../host/design-events';
import { THEMES } from '../../themes';
import { ShellPageComponent } from '../design-parts/shell-main/shell-page.component';
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
  public frameRevisions = input<unknown>(null);
  public project = input('');
  public projects = input<string[]>([]);
  public roots = input<string[]>([]);
  public busy = input(false);
  public serverStale = input(false);
  public reload = output();
  public menuOpen = output();
  public scanProjects = output();
  public removeProject = output();
  public projectChange = output<string>();
  public productNames = signal<string[]>([]);
  public productLogos = signal<Record<string, string | null>>({});
  public productName = signal('');
  public productsCheckout = signal<string | null>(null);
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
  crash: null as DesignServerCrash | null,
  log: [] as string[],
  logRevision: 0,
  phase: null as 'starting' | 'cli-build' | 'app-build' | null,
  phaseMs: 0,
};

const sent: { command: string; args: unknown }[] = [];

const stubHost = (overrides: Record<string, (args: { checkout?: string }) => unknown> = {}) => {
  const answers: Record<string, (args: { checkout?: string }) => unknown> = {
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

        return command in answers
          ? Promise.resolve(answers[command]?.(args as { checkout?: string }))
          : new Promise(() => undefined);
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

  it('hands the system view the stale flag of a server that runs an older build, and draws again on reload', async () => {
    stubHost({ design_server_state: () => ({ ...RUNNING, stale: true }) });

    const fixture = await mount();
    const projectReads = () => sent.filter((call) => call.command === 'design_project').length;
    const before = projectReads();

    expect(system(fixture)?.serverStale()).toBe(true);

    system(fixture)?.reload.emit();
    await settle(fixture);

    expect(projectReads()).toBeGreaterThan(before);
  });

  it('re-reads the server state when the menu opens', async () => {
    let stale = false;

    stubHost({ design_server_state: () => ({ ...RUNNING, stale }) });

    const fixture = await mount();

    expect(system(fixture)?.serverStale()).toBe(false);

    stale = true;
    system(fixture)?.menuOpen.emit();
    await settle(fixture);

    expect(system(fixture)?.serverStale()).toBe(true);
  });

  it('hands the system view no stale flag while the server runs the current build', async () => {
    const fixture = await mount();

    expect(system(fixture)?.serverStale()).toBe(false);
  });

  it('hands the system view the port and themes of the checkout', async () => {
    const fixture = await mount();

    expect(system(fixture)?.port()).toBe(4402);
    expect(system(fixture)?.checkout()).toBe(CHECKOUT);
  });

  it('marks the system view busy until the switched project answers', async () => {
    stubHost({ design_roots: () => ({ search: '', roots: [CHECKOUT, '/other'] }) });

    const fixture = await mount();
    let answer: (project: unknown) => void = () => undefined;

    expect(system(fixture)?.busy()).toBe(false);

    stubHost({
      design_roots: () => ({ search: '', roots: [CHECKOUT, '/other'] }),
      design_project: () => new Promise((resolve) => (answer = resolve)),
    });

    system(fixture)?.projectChange.emit('other');
    await settle(fixture);

    expect(system(fixture)?.busy()).toBe(true);

    answer(null);
    await settle(fixture);

    expect(system(fixture)?.busy()).toBe(false);
  });

  it('stays busy while a later project read runs when an earlier one answers first', async () => {
    const roots = () => ({ search: '', roots: [CHECKOUT, '/other', '/third'] });

    stubHost({ design_roots: roots });

    const fixture = await mount();
    const answers: ((project: unknown) => void)[] = [];

    stubHost({
      design_roots: roots,
      design_project: () => new Promise((resolve) => answers.push(resolve)),
    });

    system(fixture)?.projectChange.emit('other');
    await settle(fixture);
    system(fixture)?.projectChange.emit('third');
    await settle(fixture);

    answers[0]?.(null);
    await settle(fixture);

    expect(system(fixture)?.busy()).toBe(true);

    answers[1]?.(null);
    await settle(fixture);

    expect(system(fixture)?.busy()).toBe(false);
  });

  it('drops the port of the checkout before when the next one cannot be read', async () => {
    stubHost({ design_roots: () => ({ search: '', roots: [CHECKOUT, '/broken'] }) });

    const fixture = await mount();

    expect(system(fixture)?.projects()).toEqual(['checkout', 'broken']);
    expect(system(fixture)?.project()).toBe('checkout');

    stubHost({
      design_roots: () => ({ search: '', roots: [CHECKOUT, '/broken'] }),
      design_project: () => Promise.reject('No design config in /broken.'),
    });

    system(fixture)?.projectChange.emit('broken');
    await settle(fixture);

    expect(system(fixture)?.port()).toBeNull();
  });

  it('opens the checkout picked last after a restart', async () => {
    stubHost({ design_roots: () => ({ search: '', roots: [CHECKOUT, '/other'] }) });

    const first = await mount();

    system(first)?.projectChange.emit('other');
    await settle(first);
    first.destroy();

    const again = TestBed.createComponent(StudioViewComponent);

    again.autoDetectChanges();
    await settle(again);

    expect(system(again)?.checkout()).toBe('/other');
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

  it('runs the design server action of the studio menu on the stopped screen', async () => {
    const stopped = () => ({ ...RUNNING, listening: false, exited: true, log: [] });

    stubHost({ design_server_state: stopped, design_server_start: stopped });

    const fixture = await mount();
    const shell = fixture.debugElement.query(By.directive(ShellPageComponent)).componentInstance as ShellPageComponent;

    shell.action.emit({ kind: 'server', action: 'stop' });
    await settle(fixture);

    expect(sent.some((call) => call.command === 'design_server_stop')).toBe(true);
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

    expect(panel?.textContent).toContain('Design-Server gestoppt');
    expect(panel?.textContent).toContain('EMFILE: too many open files');
    expect(system(fixture)).toBeUndefined();

    if (panel) button(panel, 'Neu starten')?.click();
    await settle(fixture);

    expect(sent.some((call) => call.command === 'design_server_restart')).toBe(true);
  });

  it('keeps the product it showed last in the switcher while the design server is stopped', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });

    const foreign = { ...RUNNING, foreign: true };
    const stopped = { ...RUNNING, listening: false, exited: true };
    let current = foreign;

    stubHost({ design_server_state: () => current, design_server_start: () => stopped });

    try {
      const fixture = await mount();

      system(fixture)?.productName.set('studio');
      system(fixture)?.productNames.set(['sdk', 'studio']);
      system(fixture)?.productsCheckout.set(CHECKOUT);
      await settle(fixture);
      current = stopped;
      vi.advanceTimersByTime(3000);
      await settle(fixture);

      const shell = fixture.debugElement.query(By.directive(ShellPageComponent))
        .componentInstance as ShellPageComponent;

      expect(shell.shell().server).toBe('stopped');
      expect(shell.shell().product).toBe('studio');
      expect(shell.shell().products).toEqual(['sdk', 'studio']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('names no product of the project before while the switched project builds', async () => {
    const roots = () => ({ search: '', roots: [CHECKOUT, '/other'] });

    stubHost({ design_roots: roots });

    const fixture = await mount();

    system(fixture)?.productName.set('tomflix');
    system(fixture)?.productNames.set(['tomflix']);
    system(fixture)?.productsCheckout.set(CHECKOUT);
    await settle(fixture);

    stubHost({
      design_roots: roots,
      design_project: () => ({ ...PROJECT, port: 4403 }),
      design_server_state: ({ checkout }) =>
        checkout === '/other' ? { ...RUNNING, port: 4403, listening: false, phase: 'app-build' } : RUNNING,
      design_server_start: () => new Promise(() => undefined),
    });
    system(fixture)?.projectChange.emit('other');
    await settle(fixture);

    const shell = fixture.debugElement.query(By.directive(ShellPageComponent)).componentInstance as ShellPageComponent;

    expect(shell.shell().server).toBe('starting');
    expect(shell.shell().product).toBe('');
    expect(shell.shell().products).toEqual([]);
  });

  it('shows the crash the exited design server wrote with a Restart', async () => {
    const crashed = () => ({
      ...RUNNING,
      listening: false,
      exited: true,
      crash: {
        time: new Date(2027, 2, 2, 23, 5, 59).toISOString(),
        pid: 3500017,
        port: 4402,
        path: '/checkout/.ethlete/cache/design-server-crash.log',
        stack: ['Error: write EPIPE', '    at afterWriteDispatched (node:internal/stream_base_commons:159:15)'],
      },
    });

    stubHost({ design_server_state: crashed, design_server_start: crashed });

    const fixture = await mount();
    const panel = element(fixture).querySelector('[role="alert"]');

    expect(panel?.textContent).toContain('Design-Server abgestürzt');
    expect(panel?.textContent).toContain('Abgestürzt am 02.03.2027, 23:05:59 (PID 3500017, Port 4402)');
    expect(panel?.querySelector('pre')?.textContent).toContain('Error: write EPIPE');
    expect(panel?.textContent).toContain('/checkout/.ethlete/cache/design-server-crash.log');
    expect(system(fixture)).toBeUndefined();

    if (panel) button(panel, 'Neu starten')?.click();
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

    expect(element(fixture).textContent).toContain('Design-Server startet');
    expect(system(fixture)).toBeUndefined();

    release({ ...RUNNING, managed: true });
    await settle(fixture);

    expect(system(fixture)?.port()).toBe(4402);
  });

  it('reads the start phase from the host while the design server starts', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });

    try {
      stubHost({
        design_server_state: () => ({ ...RUNNING, listening: false, phase: 'cli-build', phaseMs: 4200 }),
      });

      const original = (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a: unknown) => unknown } })
        .__TAURI_INTERNALS__;
      const invoke = original.invoke;

      original.invoke = (command, args) =>
        command === 'design_server_start' ? new Promise(() => undefined) : invoke(command, args);

      const fixture = await mount();

      expect(fixture.componentInstance.startPhase()).toBeNull();

      vi.advanceTimersByTime(1000);
      await settle(fixture);

      expect(fixture.componentInstance.startPhase()).toEqual({ phase: 'cli-build', phaseMs: 4200 });
      expect(element(fixture).textContent).toContain('CLI wird gebaut');
      expect(element(fixture).textContent).toContain('seit 4 s');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the error of a failed start in the stopped page log', async () => {
    const stopped = () => ({ ...RUNNING, listening: false, log: ['older output'] });

    stubHost({ design_server_state: stopped });

    const original = (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a: unknown) => unknown } })
      .__TAURI_INTERNALS__;
    const invoke = original.invoke;

    original.invoke = (command, args) =>
      command === 'design_server_start'
        ? Promise.reject('studio-code.mjs cli-copy failed.\nBuilding the CLI failed.')
        : invoke(command, args);

    const fixture = await mount();
    const panel = element(fixture).querySelector('[role="alert"]');

    expect(panel?.textContent).toContain('Building the CLI failed.');
    expect(panel?.textContent).not.toContain('older output');
  });

  it('says the design server starts until it answers, then shows the system view', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });

    let answer: () => Promise<Response> = () => Promise.resolve(new Response('', { status: 500 }));

    const probed: string[] = [];

    vi.stubGlobal('fetch', (url: string) => (probed.push(url), answer()));

    try {
      const fixture = TestBed.createComponent(StudioViewComponent);

      localStorage.setItem('ethlete-studio.call-view', JSON.stringify({ checkout: CHECKOUT }));
      fixture.autoDetectChanges();
      await vi.advanceTimersByTimeAsync(10);
      await fixture.whenStable();

      expect(element(fixture).textContent).toContain('Design-Server startet');
      expect(system(fixture)).toBeUndefined();
      expect(probed).toContain('http://localhost:4402/__design/stamp');
      expect(probed.filter((url) => url.includes('/__design/system'))).toEqual([]);

      answer = () => Promise.resolve(new Response('[]', { status: 200 }));
      await vi.advanceTimersByTimeAsync(1000);
      await fixture.whenStable();

      expect(system(fixture)?.port()).toBe(4402);
    } finally {
      vi.useRealTimers();
    }
  });

  it('asks the design server again when a stamp request hangs', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });

    let answer: () => Promise<Response> = () => new Promise<Response>(() => undefined);

    vi.stubGlobal('fetch', () => answer());

    try {
      const fixture = TestBed.createComponent(StudioViewComponent);

      localStorage.setItem('ethlete-studio.call-view', JSON.stringify({ checkout: CHECKOUT }));
      fixture.autoDetectChanges();
      await vi.advanceTimersByTimeAsync(10);
      await fixture.whenStable();

      expect(element(fixture).textContent).toContain('Design-Server startet');

      answer = () => Promise.resolve(new Response('[]', { status: 200 }));
      await vi.advanceTimersByTimeAsync(10_000);
      await fixture.whenStable();

      expect(system(fixture)?.port()).toBe(4402);
    } finally {
      vi.useRealTimers();
    }
  });

  it('says the design server does not answer after 30 s without an answer, until it answers', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });

    let answer: () => Promise<Response> = () => new Promise<Response>(() => undefined);

    vi.stubGlobal('fetch', () => answer());

    try {
      const fixture = TestBed.createComponent(StudioViewComponent);

      localStorage.setItem('ethlete-studio.call-view', JSON.stringify({ checkout: CHECKOUT }));
      fixture.autoDetectChanges();
      await vi.advanceTimersByTimeAsync(29_000);
      await fixture.whenStable();

      expect(element(fixture).textContent).toContain('Design-Server startet');
      expect(element(fixture).textContent).not.toContain('antwortet nicht');

      await vi.advanceTimersByTimeAsync(1500);
      await fixture.whenStable();

      expect(element(fixture).textContent).toContain('Design-Server antwortet nicht: http://localhost:4402');
      expect(button(element(fixture), 'Neu starten')).toBeDefined();
      expect(system(fixture)).toBeUndefined();

      answer = () => Promise.resolve(new Response('[]', { status: 200 }));
      await vi.advanceTimersByTimeAsync(10_000);
      await fixture.whenStable();

      expect(element(fixture).textContent).not.toContain('antwortet nicht');
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

  it('leaves the frame reload of a restart to the new server pid', async () => {
    stubHost({ design_server_restart: () => RUNNING });

    const fixture = await mount();
    const before = system(fixture)?.epoch();

    fixture.componentInstance.restartServer();
    await settle(fixture);

    expect(sent.some((call) => call.command === 'design_server_restart')).toBe(true);
    expect(system(fixture)?.epoch()).toEqual(before);
  });

  it('stops its own server of the project before when the switched project shares its port, then shows the switched one', async () => {
    let served: string | null = CHECKOUT;
    const shown: { checkout: string; served: string | null }[] = [];
    const stateOf = (checkout?: string) =>
      served === null
        ? { ...RUNNING, listening: false }
        : { ...RUNNING, managed: served === checkout, foreign: served !== checkout };

    vi.stubGlobal('fetch', (url: string) =>
      url.endsWith('/__design/stamp') && served === null
        ? Promise.reject(new TypeError('refused'))
        : Promise.resolve(new Response(JSON.stringify({ projectRoot: served, pid: 1 }), { status: 200 })),
    );
    stubHost({
      design_roots: () => ({ search: '', roots: [CHECKOUT, '/other'] }),
      design_server_state: ({ checkout }) => stateOf(checkout),
      design_server_stop: ({ checkout }) => {
        if (served === checkout) served = null;

        return stateOf(checkout);
      },
      design_server_start: ({ checkout }) => {
        served ??= checkout ?? null;

        return stateOf(checkout);
      },
    });

    const fixture = await mount();

    expect(system(fixture)?.checkout()).toBe(CHECKOUT);

    const record = () => {
      const view = system(fixture);

      if (view?.port() != null) shown.push({ checkout: view.checkout(), served });
    };
    const watch = setInterval(record);

    system(fixture)?.projectChange.emit('other');
    await settle(fixture);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await settle(fixture);
    clearInterval(watch);
    record();

    expect(sent.filter((call) => call.command === 'design_server_stop').map((call) => call.args)).toEqual([
      { checkout: CHECKOUT },
    ]);
    expect(shown.filter((entry) => entry.checkout !== entry.served)).toEqual([]);
    expect(system(fixture)?.checkout()).toBe('/other');
    expect(served).toBe('/other');
  });

  it('shows no system view while the port of the checkout serves a project Studio did not start', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(new Response(JSON.stringify({ projectRoot: '/somewhere/else', pid: 1 }), { status: 200 })),
    );
    stubHost({ design_server_state: () => ({ ...RUNNING, foreign: true }) });

    const fixture = await mount();

    expect(system(fixture)).toBeUndefined();
    expect(element(fixture).textContent).toContain('/somewhere/else');
    expect(sent.some((call) => call.command === 'design_server_stop')).toBe(false);
  });
});
