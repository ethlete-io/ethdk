import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { ListedCall, ListedComment, ListedPart, ListedProduct, ListedSketch } from '../../host/design';
import { ListedFlow } from '../../host/design-flows';
import { CanvasFrame } from '../components/design-canvas/canvas-frame';
import { Camera } from '../components/design-canvas/canvas-math';
import { THEMES } from '../../themes';
import { STUDIO_LABELS } from '../i18n/studio-labels';
import { NO_LIST_REVISIONS } from '../studio-view/list-revisions';
import { rememberedView } from '../studio-view/remembered';
import { FlowViewComponent } from './flow-view.component';
import { SketchViewComponent } from './sketch-view.component';
import { SystemViewComponent } from './system-view.component';
import { OpenPointsChipComponent } from '../design-parts/system-page/open-points-chip.component';

const withTooltip = (root: Element | null | undefined, text: string) =>
  [...(root?.querySelectorAll<HTMLElement>('[aria-describedby]') ?? [])].find((element) =>
    (element.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .some((id) => document.getElementById(id)?.textContent?.trim() === text),
  ) ?? null;

const watchChannels: { onmessage: () => void }[] = [];

vi.mock('@tauri-apps/api/core', () => ({
  Channel: class {
    public onmessage = () => undefined;

    public constructor() {
      watchChannels.push(this);
    }
  },
  invoke: () => Promise.resolve(),
}));

const KEY = 'ethlete-studio.call-view';

const part = (layer: string, name: string): ListedPart => ({
  layer,
  name,
  origin: 'product',
  file: `.ethlete/design/web/${layer}/${name}/${name}.ts`,
  note: null,
  states: ['default'],
  problems: [],
});

const PRODUCT: ListedProduct = {
  name: 'web',
  base: null,
  presets: { phone: { width: 390 } },
  parts: [part('foundations', 'tokens'), { ...part('elements', 'rating'), interactions: ['hover'] }],
  problems: [],
};

const HOVER_COMMENT: ListedComment = {
  id: '1',
  part: 'elements/rating',
  state: 'default',
  size: 'fitted',
  interaction: 'hover',
  text: 'Too light',
  createdAt: '2026-10-27T10:00:00Z',
  replies: [],
  threadState: 'agent',
  stale: null,
};

const SKETCH_CAMERA: Camera = { x: 10, y: 20, zoom: 0.5 };

class SilentEventSource {
  public addEventListener() {
    return undefined;
  }

  public removeEventListener() {
    return undefined;
  }

  public close() {
    return undefined;
  }
}

const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body)));

const stubServer = () =>
  vi.stubGlobal('fetch', (url: string) => {
    if (url.includes('/__design/system')) return json([PRODUCT]);
    if (url.includes('/__design/calls')) return json([]);
    if (url.includes('/__design/comments')) return json({ comments: [HOVER_COMMENT], unreadable: [] });

    return new Promise(() => undefined);
  });

const settle = async (fixture: ComponentFixture<SystemViewComponent>) => {
  for (let round = 0; round < 5; round++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
};

const mount = async (remembered: object) => {
  localStorage.setItem(KEY, JSON.stringify(remembered));

  const fixture = TestBed.createComponent(SystemViewComponent);

  fixture.componentRef.setInput('port', 4402);
  fixture.componentRef.setInput('project', 'ethlete-sdk');
  fixture.autoDetectChanges();
  await settle(fixture);

  return fixture;
};

// The cold JIT compile of the component tree takes seconds on a loaded CI runner; outside this hook it lands in the 5 s budget of the first case.
beforeAll(() => {
  stubServer();
  vi.stubGlobal('EventSource', SilentEventSource);
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

  const fixture = TestBed.createComponent(SystemViewComponent);

  fixture.componentRef.setInput('port', 4402);
  fixture.componentRef.setInput('project', 'ethlete-sdk');
  fixture.detectChanges();
  fixture.destroy();
  TestBed.resetTestingModule();
  vi.unstubAllGlobals();
  localStorage.clear();
}, 30_000);

describe('SystemViewComponent on a reload', () => {
  beforeEach(() => {
    localStorage.clear();
    stubServer();
    vi.stubGlobal('EventSource', SilentEventSource);
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('shows no other part while the remembered sketch is still being listed', async () => {
    const fixture = await mount({ systemEntry: 'sketch:elements/rating' });

    expect(fixture.componentInstance['selectedKey']()).toBeNull();
    expect(fixture.componentInstance['cameraKey']()).toBeNull();
    expect(rememberedView().systemEntry).toBe('sketch:elements/rating');
  });

  it('keeps the camera of a sketch while the sketches are still being listed', async () => {
    const fixture = await mount({
      systemEntry: 'foundations/tokens',
      movedCameras: { 'web sketch:elements/rating': SKETCH_CAMERA },
    });

    fixture.componentInstance['rememberCamera']({ x: 0, y: 0, zoom: 1 });

    expect(rememberedView().movedCameras).toEqual({
      'web sketch:elements/rating': SKETCH_CAMERA,
      'web foundations/tokens': { x: 0, y: 0, zoom: 1 },
    });
  });

  it('fits a part whose only stored camera is a fitted one an older build saved', async () => {
    const fixture = await mount({
      systemProduct: 'web',
      systemEntry: 'elements/rating',
      cameras: { 'web elements/rating': { x: 250, y: 742, zoom: 1.39 } },
    });

    expect(fixture.componentInstance['cameraKey']()).toBe('web elements/rating');
    expect(fixture.componentInstance['restoredCamera']()).toBeNull();
  });

  it('draws a small part in one grid frame with a cell per interaction', async () => {
    const fixture = await mount({ systemProduct: 'web', systemEntry: 'elements/rating' });
    const frames: CanvasFrame[] = fixture.componentInstance.frames();
    const placeable: CanvasFrame[] = fixture.componentInstance['placeableFrames']();

    expect(frames.map((frame) => [frame.id, frame.grid?.columns])).toEqual([['elements/rating', ['rest', 'hover']]]);
    expect(placeable.map((frame) => [frame.place?.interaction ?? 'rest', frame.note])).toEqual([
      ['rest', undefined],
      ['hover', undefined],
    ]);
  });

  it('places the zoom chip of a part at the bottom right of the canvas, as the System page design', async () => {
    const fixture = await mount({ systemProduct: 'web', systemEntry: 'elements/rating' });
    const chip = (fixture.nativeElement as HTMLElement).querySelector('ethlete-design-canvas ethlete-zoom-chip');

    expect([...(chip?.classList ?? [])]).toEqual(
      expect.arrayContaining(['absolute', 'right-space-3', 'bottom-space-3']),
    );
  });

  it('counts the open exceptions of the shown part in the open-points chip', async () => {
    TestBed.configureTestingModule({ providers: provideColorThemesWithTailwind4(THEMES) });
    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/open-points'))
        return json({ points: [{ kind: 'contrast', state: 'hover', path: 'label' }], buildReady: { ready: true } });
      if (url.includes('/__design/exceptions'))
        return json([
          { key: 'elements/rating.star.focus', state: 'pending', reason: 'never takes focus' },
          { key: 'elements/rating.star.hover', state: 'approved', reason: 'static' },
          { key: 'components/button.label.focus', state: 'pending', reason: 'another part' },
        ]);
      if (url.includes('/__design/system')) return json([PRODUCT]);
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });

      return new Promise(() => undefined);
    });

    const fixture = await mount({ systemProduct: 'web', systemEntry: 'elements/rating' });
    const chip = (fixture.nativeElement as HTMLElement).querySelector('[data-open-points-chip]');

    expect(chip?.textContent?.trim()).toBe('2 offen');
  });

  it('shows the open points of the shown part in a chip at the top right, and lists them in its popover', async () => {
    const asked: string[] = [];

    TestBed.configureTestingModule({ providers: provideColorThemesWithTailwind4(THEMES) });
    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/open-points')) {
        asked.push(url);

        return json({
          points: [
            { kind: 'missing-motion', from: 'rest', to: 'hover' },
            { kind: 'contrast', state: 'hover', path: 'label' },
          ],
          buildReady: { ready: false, blockers: [{ kind: 'stale-record', text: 'no check record' }] },
        });
      }
      if (url.includes('/__design/system')) return json([PRODUCT]);
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });

      return new Promise(() => undefined);
    });

    const fixture = await mount({ systemProduct: 'web', systemEntry: 'elements/rating' });
    const chip = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'main .absolute.top-space-3.right-space-3 [data-open-points-chip]',
    );

    expect(asked).toContain('http://localhost:4402/__design/open-points?product=web&part=elements%2Frating');
    expect(chip?.textContent?.trim()).toBe('3 offen');
    expect(document.querySelector('ethlete-open-points-popover')).toBeNull();

    chip?.click();
    await settle(fixture);

    const lines = [...document.querySelectorAll('ethlete-open-points-popover li li')].map((line) =>
      [...line.querySelectorAll('span')].map((span) => span.textContent?.trim()),
    );

    expect(lines).toEqual([
      ['label liegt unter der Kontrastregel', 'hover'],
      ['Kein Prüfergebnis zum aktuellen Design - Design-Check oder Design-Ready ausführen', 'stale-record'],
      ['rest → hover', 'motion'],
    ]);
  });

  it('passes a design server action of the studio menu on a system page to the host', async () => {
    const fixture = await mount({ systemProduct: 'web', systemEntry: 'elements/rating' });
    const actions: string[] = [];

    fixture.componentInstance.serverAction.subscribe((action) => actions.push(action));
    fixture.componentInstance['runShellAction']({ kind: 'server', action: 'restart' });

    expect(actions).toEqual(['restart']);
  });

  it('draws the shell with the product on the rail and the tree in the side panel', async () => {
    const fixture = await mount({});
    const shell = (fixture.nativeElement as HTMLElement).querySelector('ethlete-shell-main');

    expect(shell?.querySelector('nav button[aria-label="web"]')?.getAttribute('aria-current')).toBe('true');
    expect(shell?.querySelector('nav button[aria-current="page"]')?.getAttribute('aria-label')).toBe('System');
    expect(shell?.querySelector('aside [role="tree"]')).not.toBeNull();
    expect(shell?.querySelector('aside header')?.textContent?.trim()).toBe('web');
  });

  it('draws the part tree with the part-tree part, without comment counts, and moves between them by keyboard', async () => {
    const fixture = await mount({ systemProduct: 'web', systemEntry: 'elements/rating' });
    const rows = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        'aside [role="tree"] > [role="treeitem"][ethlete-tree-row-item]',
      ),
    ];
    const rating = rows.find((row) => row.textContent?.includes('rating'));

    expect(rows.map((row) => [row.textContent?.trim(), row.dataset['kind']])).toEqual([
      ['Foundations', 'group'],
      ['tokens', 'leaf'],
      ['Elements', 'group'],
      ['rating', 'leaf'],
    ]);
    expect(rating?.getAttribute('aria-current')).toBe('true');
    expect(withTooltip(rating, '1 offener Kommentar')).toBeNull();
    expect(rating?.style.getPropertyValue('--depth')).toBe('1');

    rating?.focus();
    rating?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await settle(fixture);

    expect(document.activeElement?.textContent?.trim()).toBe('Elements');
  });

  it('lists the live comments in the Inbox section and opens the part of a picked one', async () => {
    const fixture = await mount({ systemProduct: 'web' });
    const element: HTMLElement = fixture.nativeElement;
    const view = fixture.componentInstance;

    view['pickSection']('Inbox');
    await settle(fixture);

    const row = element.querySelector<HTMLElement>('ethlete-inbox [role="button"]');

    expect(element.querySelector('ethlete-inbox aside')?.textContent).toContain('1 offen');
    expect(row?.textContent).toContain('Too light');
    expect(row?.textContent).toContain('rating › default · hover');
    expect(rememberedView().commentsOpen).toBe(true);

    row?.click();
    await settle(fixture);

    expect(view['selectedKey']()).toBe('elements/rating');

    view['pickSection']('System');
    await settle(fixture);

    expect(element.querySelector('ethlete-inbox')).toBeNull();
    expect(element.querySelector('ethlete-shell-main aside [role="tree"]')).not.toBeNull();
  });

  it('selects a picked Inbox comment and opens its pin on the canvas, on another part too, by click, Enter and Space', async () => {
    const badgeComment: ListedComment = {
      ...HOVER_COMMENT,
      id: '2',
      part: 'elements/badge',
      interaction: undefined,
      text: 'Badge too loud',
      createdAt: '2026-10-27T11:00:00Z',
    };

    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/system')) {
        return json([{ ...PRODUCT, parts: [...PRODUCT.parts, part('elements', 'badge')] }]);
      }
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/comments')) return json({ comments: [HOVER_COMMENT, badgeComment], unreadable: [] });

      return new Promise(() => undefined);
    });

    const fixture = await mount({ systemProduct: 'web', systemEntry: 'elements/rating' });
    const element: HTMLElement = fixture.nativeElement;
    const view = fixture.componentInstance;

    view['pickSection']('Inbox');
    await settle(fixture);

    const rowOf = (text: string) =>
      [...element.querySelectorAll<HTMLElement>('ethlete-inbox [role="button"]')].find((row) =>
        row.textContent?.includes(text),
      );
    const expectPicked = (key: string, id: string, text: string, other: string) => {
      expect(view['selectedKey']()).toBe(key);
      expect(rowOf(text)?.classList).toContain('bg-et-theme/20');
      expect(rowOf(other)?.classList).not.toContain('bg-et-theme/20');
      expect(
        view
          .partCanvas()
          ?.pins()
          .map((pin) => pin.id),
      ).toContain(id);
      expect(view.partCanvas()?.openPinId()).toBe(id);
    };

    expect(view['selectedKey']()).toBe('elements/rating');

    rowOf('Badge too loud')?.click();
    await settle(fixture);
    expectPicked('elements/badge', '2', 'Badge too loud', 'Too light');

    rowOf('Too light')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle(fixture);
    expectPicked('elements/rating', '1', 'Too light', 'Badge too loud');

    rowOf('Badge too loud')?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await settle(fixture);
    expectPicked('elements/badge', '2', 'Badge too loud', 'Too light');
  });

  it('selects a picked resolved Inbox comment and shows its pin resolved on the canvas, by click, Enter and Space', async () => {
    const resolvedComment: ListedComment = {
      ...HOVER_COMMENT,
      id: '2',
      part: 'elements/badge',
      interaction: undefined,
      text: 'Badge too loud',
      createdAt: '2026-10-27T11:00:00Z',
      resolved: { by: 'user', resolvedAt: '2026-10-28T09:00:00Z' },
    };

    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/system')) {
        return json([{ ...PRODUCT, parts: [...PRODUCT.parts, part('elements', 'badge')] }]);
      }
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/comments')) {
        return json({ comments: [HOVER_COMMENT, resolvedComment], unreadable: [] });
      }

      return new Promise(() => undefined);
    });

    const fixture = await mount({ systemProduct: 'web', systemEntry: 'elements/rating', resolvedShown: true });
    const element: HTMLElement = fixture.nativeElement;
    const view = fixture.componentInstance;

    view['pickSection']('Inbox');
    await settle(fixture);

    const rowOf = (text: string) =>
      [...element.querySelectorAll<HTMLElement>('ethlete-inbox [role="button"]')].find((row) =>
        row.textContent?.includes(text),
      );
    const expectResolvedPicked = () => {
      expect(view['selectedKey']()).toBe('elements/badge');
      expect(rowOf('Badge too loud')?.classList).toContain('bg-et-theme/20');
      expect(
        view
          .partCanvas()
          ?.pins()
          .find((pin) => pin.id === '2')?.resolved,
      ).toBe(true);
      expect(view.partCanvas()?.openPinId()).toBe('2');
    };

    rowOf('Badge too loud')?.click();
    await settle(fixture);
    expectResolvedPicked();

    rowOf('Too light')?.click();
    await settle(fixture);
    expect(
      view
        .partCanvas()
        ?.pins()
        .some((pin) => pin.id === '2'),
    ).toBe(false);

    rowOf('Badge too loud')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle(fixture);
    expectResolvedPicked();

    rowOf('Too light')?.click();
    await settle(fixture);
    rowOf('Badge too loud')?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await settle(fixture);
    expectResolvedPicked();
  });

  it('shows a failed comment load in the Inbox and loads the list again on retry', async () => {
    let failing = true;

    TestBed.configureTestingModule({ providers: provideColorThemesWithTailwind4(THEMES) });
    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/system')) return json([PRODUCT]);
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/comments')) {
        return failing ? Promise.reject(new Error('offline')) : json({ comments: [HOVER_COMMENT], unreadable: [] });
      }

      return new Promise(() => undefined);
    });

    const fixture = await mount({ systemProduct: 'web' });
    const element: HTMLElement = fixture.nativeElement;

    fixture.componentInstance['pickSection']('Inbox');
    await settle(fixture);

    const aside = () => element.querySelector('ethlete-inbox aside')?.textContent ?? '';

    expect(aside()).toContain('Kommentare nicht geladen');
    expect(aside()).not.toContain('offen');

    failing = false;
    [...element.querySelectorAll<HTMLButtonElement>('ethlete-inbox aside button')]
      .find((button) => button.textContent?.includes('Erneut laden'))
      ?.click();
    await settle(fixture);

    expect(aside()).toContain('1 offen');
    expect(aside()).toContain('Too light');
  });

  it('sends the pending comment draft from the Inbox editor with the text of the store', async () => {
    const written: unknown[] = [];

    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      if (url.includes('/__design/system')) return json([PRODUCT]);
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/comment') && init?.method === 'POST') {
        written.push(JSON.parse(String(init.body)));

        return json({ ...HOVER_COMMENT, id: '2', text: 'Zu eng' });
      }
      if (url.includes('/__design/comments')) return json({ comments: [HOVER_COMMENT], unreadable: [] });

      return new Promise(() => undefined);
    });

    const fixture = await mount({ systemProduct: 'web' });
    const element: HTMLElement = fixture.nativeElement;
    const store = fixture.componentInstance['commentStore'];

    fixture.componentInstance['pickSection']('Inbox');
    store.start({
      frameId: 'f',
      place: { part: 'elements/rating', state: 'default', size: 'fitted' },
      point: { x: 1, y: 2 },
    });
    store.draftText.set('Zu eng');
    await settle(fixture);

    [...element.querySelectorAll<HTMLButtonElement>('ethlete-inbox button')]
      .find((button) => button.textContent?.trim() === 'Senden')
      ?.click();
    await settle(fixture);

    expect(written).toEqual([expect.objectContaining({ text: 'Zu eng' })]);
  });
});

describe('SystemViewComponent on a product without parts or without products', () => {
  const stubProducts = (products: ListedProduct[]) =>
    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/system')) return json(products);
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });

      return new Promise(() => undefined);
    });

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('EventSource', SilentEventSource);
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('draws the empty system card with the product name for a product without parts', async () => {
    stubProducts([{ ...PRODUCT, parts: [] }]);

    const fixture = await mount({ systemProduct: 'web' });
    const card = fixture.nativeElement.querySelector('ethlete-system-empty');

    expect(card?.textContent).toContain('Noch keine Teile');
    expect(card?.textContent).toContain('Lege die Foundations für web an');
  });

  it('draws the start page with the repo while the checkout has no products', async () => {
    stubProducts([]);

    const fixture = TestBed.createComponent(SystemViewComponent);

    fixture.componentRef.setInput('port', 4402);
    fixture.componentRef.setInput('project', 'my-repo');
    fixture.autoDetectChanges();
    await settle(fixture);

    const start = fixture.nativeElement.querySelector('ethlete-start');

    expect(start?.textContent).toContain('Noch keine Produkte');
    expect(start?.textContent).toContain('Lege in my-repo das Produkt shop an');
    expect(fixture.nativeElement.querySelector('ethlete-shell-main')).toBeNull();
  });

  it('draws the start page without a repo when no checkout is open, before any design server runs', async () => {
    const fixture = TestBed.createComponent(SystemViewComponent);

    fixture.autoDetectChanges();
    await settle(fixture);

    const start = fixture.nativeElement.querySelector('ethlete-start');

    expect(start).not.toBeNull();
    expect(start?.textContent).toContain(STUDIO_LABELS.start.noRepo);
    expect(start?.querySelector('.outline-et-surface-border')).toBeNull();
    expect(fixture.nativeElement.querySelector('ethlete-shell-main')).toBeNull();
  });
});

describe('SystemViewComponent on a named list change', () => {
  const requests: string[] = [];
  const listings = (path: string) =>
    requests.filter((url) => url.includes(`/__design/${path}?`) || url.endsWith(`/__design/${path}`)).length;
  const counts = () => ({
    system: listings('system'),
    calls: listings('calls'),
    sketches: listings('sketches'),
    flows: listings('flows'),
    comments: listings('comments'),
  });

  beforeEach(() => {
    localStorage.clear();
    requests.length = 0;
    vi.stubGlobal('EventSource', SilentEventSource);
    vi.stubGlobal('fetch', (url: string) => {
      requests.push(url);

      if (url.includes('/__design/system')) return json([PRODUCT]);
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/sketches')) return json({ sketches: [] });
      if (url.includes('/__design/flows')) return json({ flows: [], unreadable: [] });
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });

      return new Promise(() => undefined);
    });
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('reads only the calls on a calls change, only the sketches on a sketches change, and every list on all', async () => {
    const fixture = await mount({});
    const before = counts();

    expect(before.calls).toBeGreaterThan(0);
    expect(before.sketches).toBeGreaterThan(0);

    fixture.componentRef.setInput('lists', { ...NO_LIST_REVISIONS, calls: 1 });
    await settle(fixture);

    expect(counts()).toEqual({ ...before, calls: before.calls + 1 });

    fixture.componentRef.setInput('lists', { ...NO_LIST_REVISIONS, calls: 1, sketches: 1 });
    await settle(fixture);

    expect(counts()).toEqual({ ...before, calls: before.calls + 1, sketches: before.sketches + 3 });

    fixture.componentRef.setInput('lists', { all: 1, products: 1, calls: 2, sketches: 2, flows: 1 });
    await settle(fixture);

    const after = counts();

    expect(Object.entries(after).every(([list, count]) => count > before[list as keyof typeof before])).toBe(true);
  });
});

describe('SystemViewComponent on a failed listing', () => {
  let sketchRequests = 0;

  beforeEach(() => {
    localStorage.clear();
    sketchRequests = 0;
    vi.stubGlobal('EventSource', SilentEventSource);
    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/system')) return json([PRODUCT]);
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });

      if (url.includes('/__design/sketches')) {
        sketchRequests++;

        return Promise.reject(new TypeError('Failed to fetch'));
      }

      if (url.includes('/__design/flows')) return Promise.reject(new TypeError('Flows down'));

      return new Promise(() => undefined);
    });
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('exposes the sketch listing error and reads again on a retry', async () => {
    const fixture = await mount({});
    const before = sketchRequests;

    expect(fixture.componentInstance.sketchesError()).toBe('Failed to fetch');

    (fixture.componentInstance as unknown as { reloadSketches: () => void }).reloadSketches();
    await settle(fixture);

    expect(sketchRequests).toBeGreaterThan(before);
  });

  it('exposes the flow listing error', async () => {
    const fixture = await mount({});

    expect(fixture.componentInstance.flowsError()).toBe('Flows down');
  });
});

describe('SystemViewComponent on a sketch report change', () => {
  beforeEach(() => {
    localStorage.clear();
    watchChannels.length = 0;
    vi.stubGlobal('__TAURI_INTERNALS__', {});
    vi.stubGlobal('EventSource', SilentEventSource);
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('lists the sketches again when the host reports a changed status file', async () => {
    let sketchListings = 0;

    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/sketches')) {
        sketchListings++;

        return json({ sketches: [] });
      }

      if (url.includes('/__design/system')) return json([PRODUCT]);
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });

      return new Promise(() => undefined);
    });

    const fixture = await mount({});
    const before = sketchListings;

    expect(before).toBeGreaterThan(0);
    expect(watchChannels.length).toBeGreaterThan(0);

    watchChannels.forEach((channel) => channel.onmessage());
    await new Promise((resolve) => setTimeout(resolve, 300));
    await settle(fixture);

    expect(sketchListings).toBe(before + 3);
  });
});

describe('SystemViewComponent on a merge', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('EventSource', SilentEventSource);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute('data-sk-rows') ? 10000 : 0;
    });
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('drops the sketch of the old product while the sketches of the new product are still being listed', async () => {
    const sketch: ListedSketch = {
      target: 'elements/rating',
      status: 'ready',
      createdAt: '2026-10-27T10:00:00Z',
      product: 'web',
      layer: 'elements',
      name: 'rating',
      dir: 'rating',
      variants: ['a', 'b'],
      problems: [],
    };

    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/sketches?product=web')) return json({ sketches: [sketch], unreadable: [] });
      if (url.includes('/__design/system')) return json([PRODUCT, { ...PRODUCT, name: 'lab' }]);
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });

      return new Promise(() => undefined);
    });

    const fixture = await mount({ systemProduct: 'web', systemEntry: 'sketch:elements/rating' });
    const view = fixture.componentInstance;

    expect(view['sketchShown']()?.sketch.product).toBe('web');

    view['pickProduct']('lab');
    await settle(fixture);

    expect(view['product']()?.name).toBe('lab');
    expect(view.sketches()).toEqual([]);
    expect(view['sketchShown']()).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-merge]')).toBeNull();
  });

  it('opens the first sketch with the side panel on a Sketches rail click from a part', async () => {
    const sketch: ListedSketch = {
      target: 'elements/rating',
      status: 'ready',
      createdAt: '2026-10-27T10:00:00Z',
      product: 'web',
      layer: 'elements',
      name: 'rating',
      dir: 'rating',
      variants: ['a', 'b'],
      problems: [],
    };

    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/sketches')) return json({ sketches: [sketch], unreadable: [] });
      if (url.includes('/__design/flows')) return json({ flows: [], unreadable: [] });
      if (url.includes('/__design/system')) return json([PRODUCT]);
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });

      return new Promise(() => undefined);
    });

    const fixture = await mount({ systemProduct: 'web', systemEntry: 'elements/rating' });
    const element: HTMLElement = fixture.nativeElement;

    element.querySelector<HTMLButtonElement>('nav button[aria-label="Sketches"]')?.click();
    await settle(fixture);

    expect(element.querySelector('ethlete-sketch-view')).not.toBeNull();
    expect(element.querySelector('ethlete-sketch-view aside')).not.toBeNull();
    expect(fixture.componentInstance.panel()).toBe('open');
    expect(rememberedView().systemEntry).toBe('sketch:elements/rating');
  });

  it('leaves an open sketch and marks System current on a System rail click', async () => {
    const sketch: ListedSketch = {
      target: 'elements/rating',
      status: 'ready',
      createdAt: '2026-10-27T10:00:00Z',
      product: 'web',
      layer: 'elements',
      name: 'rating',
      dir: 'rating',
      variants: ['a', 'b'],
      problems: [],
    };

    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/sketches')) return json({ sketches: [sketch], unreadable: [] });
      if (url.includes('/__design/flows')) return json({ flows: [], unreadable: [] });
      if (url.includes('/__design/system')) return json([PRODUCT]);
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });

      return new Promise(() => undefined);
    });

    const fixture = await mount({ systemProduct: 'web', systemEntry: 'sketch:elements/rating' });
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('ethlete-sketch-view')).not.toBeNull();

    element.querySelector<HTMLButtonElement>('nav button[aria-label="System"]')?.click();
    await settle(fixture);

    expect(element.querySelector('ethlete-sketch-view')).toBeNull();
    expect(element.querySelector('nav button[aria-label="System"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('shows the part a merged sketch targeted, once the sketches list no longer has the sketch', async () => {
    const sketch: ListedSketch = {
      target: 'elements/rating',
      status: 'ready',
      createdAt: '2026-10-27T10:00:00Z',
      product: 'web',
      layer: 'elements',
      name: 'rating',
      dir: 'rating',
      variants: ['a', 'b'],
      problems: [],
    };
    let merged = false;

    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/sketches')) return json({ sketches: merged ? [] : [sketch], unreadable: [] });
      if (url.includes('/__design/flows')) return json({ flows: [], unreadable: [] });
      if (url.includes('/__design/system')) return json([PRODUCT]);
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });

      return new Promise(() => undefined);
    });

    const fixture = await mount({ systemProduct: 'web', systemEntry: 'sketch:elements/rating' });
    const view = fixture.componentInstance;

    expect(view['sketchShown']()?.sketch.target).toBe('elements/rating');

    merged = true;
    fixture.componentRef.setInput('lists', { ...NO_LIST_REVISIONS, sketches: 1 });
    await settle(fixture);

    expect(view['sketchShown']()).toBeNull();
    expect(view['selectedKey']()).toBe('elements/rating');
  });

  it('shows the part a merged sketch targeted once the name listing drops it, while the listings with targets hang', async () => {
    const sketch: ListedSketch = {
      target: 'elements/rating',
      status: 'ready',
      createdAt: '2026-10-27T10:00:00Z',
      product: 'web',
      layer: 'elements',
      name: 'rating',
      dir: 'rating',
      variants: ['a', 'b'],
      problems: [],
    };
    let merged = false;

    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/sketches')) {
        if (!merged) return json({ sketches: [sketch], unreadable: [] });

        return url.includes('targets=no') ? json({ sketches: [], unreadable: [] }) : new Promise(() => undefined);
      }

      if (url.includes('/__design/flows')) return json({ flows: [], unreadable: [] });
      if (url.includes('/__design/system')) return json([PRODUCT]);
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });

      return new Promise(() => undefined);
    });

    const fixture = await mount({ systemProduct: 'web', systemEntry: 'sketch:elements/rating' });
    const view = fixture.componentInstance;

    expect(view['sketchShown']()?.sketch.target).toBe('elements/rating');

    merged = true;
    fixture.componentRef.setInput('lists', { ...NO_LIST_REVISIONS, sketches: 1 });
    await settle(fixture);

    expect(view['sketchShown']()).toBeNull();
    expect(view['selectedKey']()).toBe('elements/rating');
  });

  it('keeps the targets of a still listed sketch while the listings with targets of a new read hang', async () => {
    const sketch: ListedSketch = {
      target: 'elements/rating',
      status: 'ready',
      createdAt: '2026-10-27T10:00:00Z',
      product: 'web',
      layer: 'elements',
      name: 'rating',
      dir: 'rating',
      variants: ['a'],
      problems: [],
      targets: [{ variant: 'a', states: ['default'] }],
    };
    let reread = false;

    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/sketches')) {
        if (!reread) return json({ sketches: [sketch], unreadable: [] });

        return url.includes('targets=no')
          ? json({ sketches: [{ ...sketch, targets: undefined, problems: undefined }], unreadable: [] })
          : new Promise(() => undefined);
      }

      if (url.includes('/__design/flows')) return json({ flows: [], unreadable: [] });
      if (url.includes('/__design/system')) return json([PRODUCT]);
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });

      return new Promise(() => undefined);
    });

    const fixture = await mount({ systemProduct: 'web', systemEntry: 'sketch:elements/rating' });
    const view = fixture.componentInstance;

    reread = true;
    fixture.componentRef.setInput('lists', { ...NO_LIST_REVISIONS, sketches: 1 });
    await settle(fixture);

    expect(view['sketchShown']()?.sketch.targets).toEqual(sketch.targets);
  });

  it('opens the target part and draws no frame of the sketch at once when the open sketch is discarded, before the listing drops it', async () => {
    const sketch: ListedSketch = {
      target: 'elements/rating',
      status: 'ready',
      createdAt: '2026-10-27T10:00:00Z',
      product: 'web',
      layer: 'elements',
      name: 'rating',
      dir: 'rating',
      variants: ['a', 'b'],
      problems: [],
    };

    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/sketch-discard')) return json({ ok: true });
      if (url.includes('/__design/sketches')) return json({ sketches: [sketch], unreadable: [] });
      if (url.includes('/__design/flows')) return json({ flows: [], unreadable: [] });
      if (url.includes('/__design/system')) return json([PRODUCT]);
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });

      return new Promise(() => undefined);
    });

    const fixture = await mount({ systemProduct: 'web', systemEntry: 'sketch:elements/rating' });
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('ethlete-sketch-view')).not.toBeNull();

    fixture.debugElement.query(By.directive(SketchViewComponent)).componentInstance['discard']();
    await settle(fixture);

    expect(element.querySelector('ethlete-sketch-view')).toBeNull();
    expect(element.querySelector('iframe[src*="sketch="]')).toBeNull();
    expect(fixture.componentInstance['part']()?.key).toBe('elements/rating');
    expect(fixture.componentInstance['selectedKey']()).toBe('elements/rating');
  });

  it('lists the sketches in the tree from the quick answer without problems and targets', async () => {
    const sketch: ListedSketch = {
      target: 'elements/rating',
      status: 'ready',
      createdAt: '2026-10-27T10:00:00Z',
      product: 'web',
      layer: 'elements',
      name: 'rating',
      dir: 'rating',
      variants: ['a', 'b'],
    };

    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/sketches')) {
        return url.includes('unchanged=no')
          ? json({ sketches: [sketch], unreadable: [] })
          : new Promise(() => undefined);
      }

      if (url.includes('/__design/flows')) return json({ flows: [], unreadable: [] });
      if (url.includes('/__design/system')) return json([PRODUCT]);
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });

      return new Promise(() => undefined);
    });

    const fixture = await mount({ systemProduct: 'web', systemEntry: 'sketch:elements/rating' });
    const sketches = fixture.componentInstance['tree']().find((group) => group.key === 'sketches');

    expect(sketches?.entries.map(({ key, badges }) => ({ key, badges }))).toEqual([
      { key: 'sketch:elements/rating', badges: ['ready'] },
    ]);
    expect(fixture.componentInstance['sketchShown']()?.sketch.target).toBe('elements/rating');
  });

  it('lists the sketches in the tree from the name listing while the quick and the full listing never answer', async () => {
    const sketch: ListedSketch = {
      target: 'elements/rating',
      status: 'ready',
      createdAt: '2026-10-27T10:00:00Z',
      product: 'web',
      layer: 'elements',
      name: 'rating',
      dir: 'rating',
      variants: ['a', 'b'],
    };

    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/sketches')) {
        return url.includes('targets=no') ? json({ sketches: [sketch], unreadable: [] }) : new Promise(() => undefined);
      }

      if (url.includes('/__design/flows')) return json({ flows: [], unreadable: [] });
      if (url.includes('/__design/system')) return json([PRODUCT]);
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });

      return new Promise(() => undefined);
    });

    const fixture = await mount({ systemProduct: 'web', systemEntry: null });
    const sketches = fixture.componentInstance['tree']().find((group) => group.key === 'sketches');

    expect(sketches?.entries.map(({ key }) => key)).toEqual(['sketch:elements/rating']);
  });

  it('shows the picked sketch before the slow listing with its unchanged states answers', async () => {
    const sketch: ListedSketch = {
      target: 'elements/rating',
      status: 'ready',
      createdAt: '2026-10-27T10:00:00Z',
      product: 'web',
      layer: 'elements',
      name: 'rating',
      dir: 'rating',
      variants: ['a', 'b'],
      problems: [],
    };

    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/sketches')) {
        return url.includes('unchanged=no')
          ? json({ sketches: [sketch], unreadable: [] })
          : new Promise(() => undefined);
      }

      if (url.includes('/__design/system')) return json([PRODUCT]);
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });

      return new Promise(() => undefined);
    });

    const fixture = await mount({ systemProduct: 'web', systemEntry: 'sketch:elements/rating' });

    expect(fixture.componentInstance['sketchShown']()?.sketch.target).toBe('elements/rating');
  });

  it('drops a merged sketch from the tree at once while the full listing is still slow', async () => {
    const sketch: ListedSketch = {
      target: 'elements/rating',
      status: 'ready',
      createdAt: '2026-10-27T10:00:00Z',
      product: 'web',
      layer: 'elements',
      name: 'rating',
      dir: 'rating',
      variants: ['a', 'b'],
      problems: [],
    };
    let merged = false;

    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/sketches')) {
        const answer = json({ sketches: merged ? [] : [sketch], unreadable: [] });

        return url.includes('unchanged=no')
          ? answer
          : new Promise((resolve) => setTimeout(() => resolve(answer), 10000));
      }

      if (url.includes('/__design/flows')) return json({ flows: [], unreadable: [] });
      if (url.includes('/__design/system')) return json([PRODUCT]);
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });

      return new Promise(() => undefined);
    });

    const fixture = await mount({ systemProduct: 'web', systemEntry: 'sketch:elements/rating' });
    const view = fixture.componentInstance;

    expect(view.sketches().length).toBe(1);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    merged = true;
    merged = true;
    fixture.debugElement
      .query(By.directive(SketchViewComponent))
      .componentInstance.mergeComplete.emit('elements/rating');
    fixture.componentRef.setInput('lists', { ...NO_LIST_REVISIONS, sketches: 1 });
    await vi.advanceTimersByTimeAsync(1000);
    await fixture.whenStable();

    expect(view.sketches()).toEqual([]);

    vi.useRealTimers();
  });

  it.each([
    { kind: 'variant', target: 'elements/rating', extra: { variants: ['a', 'b'] } },
    {
      kind: 'edit',
      target: 'elements/rating@edit',
      extra: { variants: ['new', 'old'], targetParts: ['elements/rating'] },
    },
  ])(
    'marks the $kind sketch "merging" while the merge runs, then selects the target part',
    async ({ target, extra }) => {
      const sketch: ListedSketch = {
        target,
        status: 'ready',
        createdAt: '2026-10-27T10:00:00Z',
        decision: { kind: 'pick', variant: 'b', decidedAt: '2026-10-27T10:00:00Z' },
        product: 'web',
        layer: 'elements',
        name: 'rating',
        dir: 'rating',
        problems: [],
        ...extra,
      };
      let sketches = [sketch];
      let finishMerge = () => undefined as void;

      vi.stubGlobal('fetch', (url: string) => {
        if (url.includes('/__design/sketches')) return json({ sketches, unreadable: [] });
        if (url.includes('/__design/system')) return json([PRODUCT]);
        if (url.includes('/__design/calls')) return json([]);
        if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });
        if (url.includes('/__design/sketch-decision')) return json({});
        if (url.includes('/__design/sketch-merge'))
          return new Promise<Response>((done) => {
            finishMerge = () => {
              sketches = [];
              done(new Response(JSON.stringify({ merged: ['elements/rating'] })));
            };
          });

        return new Promise(() => undefined);
      });

      const fixture = await mount({ systemEntry: `sketch:${target}` });
      const root: HTMLElement = fixture.nativeElement;

      expect(fixture.componentInstance['selectedKey']()).toBe(`sketch:${target}`);
      expect(fixture.debugElement.query(By.directive(SketchViewComponent))).not.toBeNull();

      const clickButton = (label: string) =>
        [...root.querySelectorAll<HTMLButtonElement>('button')].filter(
          (button) => button.textContent?.trim() === label,
        );

      clickButton('Übernehmen')[1]?.click();
      await settle(fixture);

      const clickMerge = () => clickButton('Merge')[0]?.click();

      clickMerge();
      await settle(fixture);
      clickMerge();
      await settle(fixture);

      finishMerge();
      await settle(fixture);

      expect(fixture.componentInstance['selectedKey']()).toBe('elements/rating');
      expect(rememberedView().systemEntry).toBe('elements/rating');
    },
  );

  it('selects the target part when the listing drops the merged edit sketch before the merge answers', async () => {
    const target = 'elements/rating@edit';
    const sketch: ListedSketch = {
      target,
      status: 'ready',
      createdAt: '2026-10-27T10:00:00Z',
      decision: { kind: 'pick', variant: 'new', decidedAt: '2026-10-27T10:00:00Z' },
      product: 'web',
      layer: 'elements',
      name: 'rating',
      dir: 'rating',
      problems: [],
      variants: ['new', 'old'],
      targetParts: ['elements/rating'],
    };
    let sketches = [sketch];
    let finishMerge = () => undefined as void;

    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/sketches')) return json({ sketches, unreadable: [] });
      if (url.includes('/__design/system')) return json([PRODUCT]);
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });
      if (url.includes('/__design/sketch-decision')) return json({});
      if (url.includes('/__design/sketch-merge'))
        return new Promise<Response>((done) => {
          finishMerge = () => done(new Response(JSON.stringify({ merged: ['elements/rating'] })));
        });

      return new Promise(() => undefined);
    });

    const fixture = await mount({ systemEntry: `sketch:${target}` });
    const root: HTMLElement = fixture.nativeElement;
    const clickButton = (label: string) =>
      [...root.querySelectorAll<HTMLButtonElement>('button')].filter((button) => button.textContent?.trim() === label);

    clickButton('Übernehmen')[1]?.click();
    await settle(fixture);
    clickButton('Merge')[0]?.click();
    await settle(fixture);
    clickButton('Merge')[0]?.click();
    await settle(fixture);

    sketches = [];
    fixture.componentRef.setInput('lists', { ...NO_LIST_REVISIONS, sketches: 1 });
    await settle(fixture);

    expect(fixture.debugElement.query(By.directive(SketchViewComponent))).toBeNull();

    finishMerge();
    await settle(fixture);

    expect(fixture.componentInstance['selectedKey']()).toBe('elements/rating');
    expect(rememberedView().systemEntry).toBe('elements/rating');
  });
});

describe('SystemViewComponent on a flow', () => {
  const library: ListedPart = { ...part('pages', 'library'), states: ['empty', 'one'] };
  const flowProduct: ListedProduct = {
    ...PRODUCT,
    presets: { phone: { width: 390 }, desktop: { width: 1280 } },
    parts: [library],
  };
  const flow = {
    name: 'sign-in',
    file: 'flows/sign-in.json',
    frames: [
      { part: 'pages/library', state: 'empty' },
      { part: 'pages/library', state: 'one' },
    ],
    lines: [],
    notes: [],
    problems: [],
  };
  const comment: ListedComment = { ...HOVER_COMMENT, part: 'pages/library', state: 'one', size: 'desktop' };
  delete comment.interaction;

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('EventSource', SilentEventSource);
    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/system')) return json([flowProduct]);
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/flows')) return json({ flows: [flow], unreadable: [] });
      if (url.includes('/__design/comments')) return json({ comments: [comment], unreadable: [] });

      return new Promise(() => undefined);
    });
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  const flowViewOf = (fixture: ComponentFixture<SystemViewComponent>): FlowViewComponent =>
    fixture.debugElement.query(By.directive(FlowViewComponent)).componentInstance;

  it('draws the picked flow on the flows page, its frames as iframes along its lines', async () => {
    const fixture = await mount({ systemProduct: 'web', systemEntry: 'flow:sign-in' });
    const root: HTMLElement = fixture.nativeElement;
    const frames = [...root.querySelectorAll<HTMLIFrameElement>('ethlete-flows-page iframe')];

    expect(fixture.componentInstance['section']()).toBe('Flows');
    expect(root.querySelector('[role="treeitem"]')?.textContent?.trim()).toBe('sign-in');
    expect(frames.map((frame) => frame.title)).toEqual(['pages/library · empty', 'pages/library · one']);
    expect(frames[0]?.src).toContain('/frame.html?');
  });

  it('shows the first flow on the Flows section, and opens a flow from its list', async () => {
    const fixture = await mount({ systemProduct: 'web', systemEntry: 'pages/library' });

    fixture.componentInstance['pickSection']('Flows');
    await settle(fixture);

    expect(flowViewOf(fixture).flow()?.name).toBe('sign-in');

    fixture.nativeElement.querySelector('[role="treeitem"]')?.click();
    await settle(fixture);

    expect(fixture.componentInstance['selectedKey']()).toBe('flow:sign-in');
  });

  it('picks the first part when going back to System from a picked flow', async () => {
    const fixture = await mount({ systemProduct: 'web', systemEntry: 'flow:sign-in' });

    fixture.componentInstance['pickSection']('System');
    await settle(fixture);

    expect(fixture.componentInstance['selectedKey']()).toBe('pages/library');
    expect(fixture.componentInstance['flowShown']()).toBeNull();
  });

  it('remembers the picked preset per flow for the next start', async () => {
    const first = await mount({ systemProduct: 'web', systemEntry: 'flow:sign-in' });

    flowViewOf(first)['pickPreset']('desktop');
    first.destroy();

    expect(rememberedView().flowPresets).toEqual({ 'web flow:sign-in': 'desktop' });

    const second = await mount(JSON.parse(localStorage.getItem(KEY) ?? '{}'));

    expect(flowViewOf(second)['preset']()).toBe('desktop');
  });

  it('reads the flows again when the design server reports a changed flow file', async () => {
    const streams: EventTarget[] = [];
    let frames = flow.frames;

    vi.stubGlobal(
      'EventSource',
      class extends EventTarget {
        public constructor() {
          super();
          streams.push(this);
        }

        public close() {
          return undefined;
        }
      },
    );
    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/system')) return json([flowProduct]);
      if (url.includes('/__design/flows')) return json({ flows: [{ ...flow, frames }], unreadable: [] });
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });
      if (url.includes('/__design/notes')) return json({ notes: [], unreadable: [] });

      return json([]);
    });

    const fixture = await mount({ systemProduct: 'web', systemEntry: 'flow:sign-in' });
    const shown = () => flowViewOf(fixture).flow()?.frames.length;

    expect(shown()).toBe(2);

    frames = flow.frames.slice(0, 1);
    streams.forEach((stream) => stream.dispatchEvent(new Event('flows')));
    await settle(fixture);

    expect(shown()).toBe(1);
  });
});

describe('SystemViewComponent on a tree pick', () => {
  const EDIT: ListedSketch = {
    target: 'elements/rating@edit',
    targetParts: ['elements/rating'],
    status: 'ready',
    createdAt: '2026-11-04T13:53:56.932Z',
    product: 'web',
    layer: 'elements',
    name: 'rating',
    dir: 'rating.edit',
    variants: ['old', 'new'],
    problems: [
      { variant: 'old', problems: [{ rule: 'LOAD', file: 'rating.edit/old/rating.ts', message: 'no export' }] },
    ],
    targets: [
      { part: 'elements/rating', variant: 'old', states: [], error: 'old fails to render' },
      { part: 'elements/rating', variant: 'new', states: ['default'] },
    ],
  };
  const FLOW: ListedFlow = {
    name: 'sign-in',
    file: 'web/flows/sign-in.json',
    frames: [],
    lines: [],
    notes: [],
    problems: [],
  };
  const CALL: ListedCall = { slug: 'web/start', project: 'web', error: 'unreadable call' };

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('EventSource', SilentEventSource);
    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/sketches')) return json({ sketches: [EDIT], unreadable: [] });
      if (url.includes('/__design/flows')) return json({ flows: [FLOW], unreadable: [] });
      if (url.includes('/__design/system')) return json([PRODUCT]);
      if (url.includes('/__design/calls')) return json([CALL]);
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });

      return new Promise(() => undefined);
    });
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  const pick = async (fixture: ComponentFixture<SystemViewComponent>, group: string, name: string) => {
    const rows = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        'aside [role="tree"] [role="treeitem"][ethlete-tree-row-item]',
      ),
    ];
    const start = rows.findIndex((row) => row.dataset['kind'] === 'group' && row.textContent?.trim() === group);
    const row = rows.slice(start + 1).find((candidate) => candidate.textContent?.trim() === name);

    expect(row).toBeDefined();
    row?.click();
    await settle(fixture);
  };

  it('opens the part canvas with its actions on a part row', async () => {
    const fixture = await mount({ systemProduct: 'web', systemEntry: 'foundations/tokens' });
    const element: HTMLElement = fixture.nativeElement;

    await pick(fixture, 'Elements', 'rating');

    expect(rememberedView().systemEntry).toBe('elements/rating');
    expect(element.querySelector('ethlete-open-points-chip')).not.toBeNull();
    expect(element.querySelector('ethlete-sketch-view')).toBeNull();
  });

  it('shows a direct edit as a build-ready blocker without a Go button and opens the edit sketch only on request', async () => {
    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/open-points'))
        return json({
          points: [{ kind: 'direct-edit', sketch: 'elements/rating@edit' }],
          buildReady: { ready: false, blockers: [{ kind: 'open-point', text: 'changed outside a sketch' }] },
        });
      if (url.includes('/__design/sketches')) return json({ sketches: [EDIT], unreadable: [] });
      if (url.includes('/__design/system')) return json([PRODUCT]);
      if (url.includes('/__design/calls')) return json([CALL]);
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });

      return new Promise(() => undefined);
    });

    const fixture = await mount({ systemProduct: 'web', systemEntry: 'elements/rating' });
    const element: HTMLElement = fixture.nativeElement;
    const chip = fixture.debugElement.query(By.directive(OpenPointsChipComponent));

    expect(chip.componentInstance.buildReady()).toEqual({
      state: 'blocked',
      blockers: [{ kind: 'direct-edit', text: 'Bild ohne Sketch geändert' }],
    });
    expect(element.querySelector('ethlete-sketch-view')).toBeNull();
    expect(element.querySelector('ethlete-part-approval')).toBeNull();

    element.querySelector<HTMLButtonElement>('[data-open-points-chip]')?.click();
    await settle(fixture);

    const popover = document.querySelector('ethlete-open-points-popover');

    expect(popover?.querySelector('ethlete-build-ready-footer')?.textContent).toContain('Nicht baubereit (1)');

    chip.componentInstance.openEditSketch.emit({ kind: 'direct-edit', text: 'Bild ohne Sketch geändert' });
    await settle(fixture);

    expect(rememberedView().systemEntry).toBe('sketch:elements/rating@edit');
    expect(element.querySelector('ethlete-sketch-view')).not.toBeNull();
  });

  it('opens the sketch view on a sketch row whose old variant fails to render', async () => {
    const fixture = await mount({ systemProduct: 'web', systemEntry: 'elements/rating' });
    const element: HTMLElement = fixture.nativeElement;

    await pick(fixture, 'Sketches', 'rating');

    expect(rememberedView().systemEntry).toBe('sketch:elements/rating@edit');
    expect(element.querySelector('ethlete-sketch-view')).not.toBeNull();
    expect(element.querySelector('ethlete-open-points-chip')).toBeNull();
  });

  it('opens the flow view on a flow row', async () => {
    const fixture = await mount({ systemProduct: 'web', systemEntry: 'elements/rating' });
    const element: HTMLElement = fixture.nativeElement;

    await pick(fixture, 'Flows', 'sign-in');

    expect(rememberedView().systemEntry).toBe('flow:sign-in');
    expect(element.querySelector('ethlete-flow-view')).not.toBeNull();
    expect(element.querySelector('ethlete-open-points-chip')).toBeNull();
  });

  it('opens the call with its header on a call row', async () => {
    const fixture = await mount({ systemProduct: 'web', systemEntry: 'elements/rating', openGroups: { legacy: true } });
    const element: HTMLElement = fixture.nativeElement;

    await pick(fixture, 'Legacy', 'start');

    expect(rememberedView().systemEntry).toBe('legacy:web/start');
    expect(element.querySelector('main')?.textContent).toContain('web/start: unreadable call');
    expect(element.querySelector('ethlete-open-points-chip')).toBeNull();
  });

  it('opens a readable call in the system page with its header, its canvas and the transfer action', async () => {
    const posts: string[] = [];
    const readable: ListedCall = {
      slug: 'web/start',
      project: 'web',
      eyebrow: 'Start',
      headline: 'A start page for the web app',
      stage: null,
      legacy: true,
      transferred: false,
      closed: null,
      frameWidth: 1280,
      variants: [],
    };

    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      if (url.includes('/__design/transfer')) {
        posts.push(`${init?.method} ${url}`);

        return json({ result: 'transferred' });
      }
      if (url.includes('/__design/system')) return json([PRODUCT]);
      if (url.includes('/__design/calls')) return json([readable]);
      if (url.includes('/__design/sketches')) return json({ sketches: [], unreadable: [] });
      if (url.includes('/__design/flows')) return json({ flows: [], unreadable: [] });
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });

      return new Promise(() => undefined);
    });

    const fixture = await mount({ systemProduct: 'web', systemEntry: 'legacy:web/start' });
    const page: HTMLElement | null = (fixture.nativeElement as HTMLElement).querySelector('ethlete-system-page');
    const transfer = [...(page?.querySelectorAll<HTMLButtonElement>('header button') ?? [])].find(
      (button) => button.textContent?.trim() === STUDIO_LABELS.shell.markTransferred,
    );

    expect(page?.querySelector('header h2')?.textContent?.trim()).toBe('A start page for the web app');
    expect(page?.querySelector('[systemCallCanvas] ethlete-design-canvas')).not.toBeNull();
    expect(page?.querySelector('ethlete-canvas-frames')).toBeNull();

    transfer?.click();
    await settle(fixture);

    expect(posts).toEqual(['POST http://localhost:4402/__design/transfer?call=web%2Fstart']);
  });

  it('says the sketch is not found once the lists are read without it, instead of showing another part', async () => {
    const fixture = await mount({ systemProduct: 'web', systemEntry: 'sketch:elements/gone' });
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('[data-sketch-missing]')?.textContent?.trim()).toBe(
      STUDIO_LABELS.system.sketchMissing,
    );
    expect(element.querySelector('ethlete-open-points-chip')).toBeNull();
  });

  it('shows the target part of a gone edit sketch', async () => {
    const fixture = await mount({ systemProduct: 'web', systemEntry: 'sketch:elements/rating@other' });

    expect(fixture.componentInstance['part']()?.key).toBe('elements/rating');
    expect(fixture.nativeElement.querySelector('[data-sketch-missing]')).toBeNull();
  });
});
