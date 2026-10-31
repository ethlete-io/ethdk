import { WritableSignal, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ListedComment, ListedPart, ListedProduct, ListedSketch } from '../../host/design';
import { ListedNote } from '../../host/design-notes';
import { CanvasFrame } from '../components/design-canvas/canvas-frame';
import { Camera } from '../components/design-canvas/canvas-math';
import { DesignCanvasComponent } from '../components/design-canvas/design-canvas.component';
import { NO_LIST_REVISIONS } from '../studio-view/list-revisions';
import { rememberedView } from '../studio-view/remembered';
import { FlowViewComponent } from './flow-view.component';
import { injectViewContext } from '../chat/view-context';
import { SketchViewComponent } from './sketch-view.component';
import { baseLabelOf, SystemViewComponent } from './system-view.component';

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
  fixture.autoDetectChanges();
  await settle(fixture);

  return fixture;
};

describe('baseLabelOf', () => {
  it('names a base path by its last folder and keeps the built-in base whole', () => {
    expect(baseLabelOf('.ethlete/design/web')).toBe('web');
    expect(baseLabelOf('../shared/web/')).toBe('web');
    expect(baseLabelOf('@ethlete/components')).toBe('@ethlete/components');
  });
});

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

  it('draws a small part in one grid frame whose cells take comments in their own interaction', async () => {
    const fixture = await mount({ systemProduct: 'web', systemEntry: 'elements/rating' });
    const frames: CanvasFrame[] = fixture.componentInstance['notedFrames']();
    const placeable: CanvasFrame[] = fixture.componentInstance['placeableFrames']();

    expect(frames.map((frame) => [frame.id, frame.grid?.columns])).toEqual([['elements/rating', ['rest', 'hover']]]);
    expect(placeable.map((frame) => [frame.place?.interaction ?? 'rest', frame.note])).toEqual([
      ['rest', undefined],
      ['hover', undefined],
    ]);
  });

  it('heads the sidebar with the Studio mark beside the "Studio" label', async () => {
    const fixture = await mount({});
    const header = (fixture.nativeElement as HTMLElement).querySelector('aside > header');

    expect(header?.querySelector('ethlete-studio-mark svg path')).not.toBeNull();
    expect(header?.textContent?.trim()).toBe('Studio');
  });

  it('offers the one product and "New product" in the picker', async () => {
    const fixture = await mount({});
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('et-select')).not.toBeNull();
    expect([...element.querySelectorAll('et-select-option')].map((option) => option.textContent?.trim())).toEqual([
      'web',
      'New product',
    ]);
  });

  it('shows the new-product screen while "New product" is picked, and goes back on another pick', async () => {
    const fixture = await mount({ systemProduct: 'web' });
    const element: HTMLElement = fixture.nativeElement;
    const view = fixture.componentInstance;

    view['pickProduct'](view['NEW_PRODUCT']);
    await settle(fixture);

    expect(element.querySelector('main h2')?.textContent?.trim()).toBe('New product');
    expect(element.querySelector('main pre')?.textContent).toBe('npx et design product new web');
    expect(view['pickerValue']()).toBe(view['NEW_PRODUCT']);
    expect(rememberedView().systemProduct).toBe('web');

    view['pickProduct']('web');
    await settle(fixture);

    expect(element.querySelector('main h2')).toBeNull();
    expect(view['pickerValue']()).toBe('web');
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
    notes: listings('notes'),
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
      if (url.includes('/__design/notes')) return json({ notes: [], unreadable: [] });

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

    expect(counts()).toEqual({ ...before, calls: before.calls + 1, sketches: before.sketches + 1 });

    fixture.componentRef.setInput('lists', { all: 1, products: 1, calls: 2, sketches: 2, flows: 1 });
    await settle(fixture);

    const after = counts();

    expect(Object.entries(after).every(([list, count]) => count > before[list as keyof typeof before])).toBe(true);
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

    expect(sketchListings).toBe(before + 1);
  });
});

describe('SystemViewComponent on a merge', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('EventSource', SilentEventSource);
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it('marks the sketch "merging" while the merge runs, then selects the target part', async () => {
    const sketch: ListedSketch = {
      target: 'elements/rating',
      status: 'ready',
      createdAt: '2026-10-27T10:00:00Z',
      decision: { kind: 'pick', variant: 'b', decidedAt: '2026-10-27T10:00:00Z' },
      product: 'web',
      layer: 'elements',
      name: 'rating',
      dir: 'rating',
      variants: ['a', 'b'],
      problems: [],
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

    const fixture = await mount({ systemEntry: 'sketch:elements/rating' });
    const root: HTMLElement = fixture.nativeElement;
    const sketchView = fixture.debugElement.query(By.directive(SketchViewComponent)).componentInstance as object;

    expect(fixture.componentInstance['selectedKey']()).toBe('sketch:elements/rating');

    (sketchView as { note: WritableSignal<string> })['note'].set('Calmer.');
    await settle(fixture);
    root.querySelector<HTMLButtonElement>('[data-merge]')?.click();
    await settle(fixture);

    expect(root.querySelector('[data-tree-merging]')?.textContent).toContain('merging');

    finishMerge();
    await settle(fixture);

    expect(root.querySelector('[data-tree-merging]')).toBeNull();
    expect(fixture.componentInstance['selectedKey']()).toBe('elements/rating');
    expect(rememberedView().systemEntry).toBe('elements/rating');
  });

  it('shows the kit-part count next to a wireframe page', async () => {
    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/system'))
        return json([{ ...PRODUCT, parts: [...PRODUCT.parts, { ...part('pages', 'login'), kitUses: 6 }] }]);
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });

      return new Promise(() => undefined);
    });

    const fixture = await mount({ systemEntry: 'pages/login' });
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('[data-tree-kit-count]')?.textContent?.trim()).toBe('6');
  });

  it('marks a part changed outside a sketch in the tree and above its frame', async () => {
    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/system'))
        return json([{ ...PRODUCT, parts: [{ ...part('elements', 'rating'), changedOutsideSketch: true }] }]);
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });

      return new Promise(() => undefined);
    });

    const fixture = await mount({ systemProduct: 'web', systemEntry: 'elements/rating' });
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('[data-tree-changed]')?.getAttribute('title')).toBe('changed outside a sketch');
    expect(root.querySelector('[data-changed-outside-sketch]')?.getAttribute('title')).toBe('changed outside a sketch');
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
  const note: ListedNote = {
    id: 'n1',
    part: 'pages/library',
    state: 'empty',
    point: { x: 40, y: 120 },
    size: 'phone',
    text: 'Invites the first film',
    file: 'notes/n1.json',
    stale: null,
  };

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('EventSource', SilentEventSource);
    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/system')) return json([flowProduct]);
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/flows')) return json({ flows: [flow], unreadable: [] });
      if (url.includes('/__design/comments')) return json({ comments: [comment], unreadable: [] });
      if (url.includes('/__design/notes')) return json({ notes: [note], unreadable: [] });

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

  it('pins a comment on a state at the shown preset to its flow frame, and nothing at another preset', async () => {
    const fixture = await mount({ systemProduct: 'web', systemEntry: 'flow:sign-in' });
    const flowView = flowViewOf(fixture);

    expect(flowView['pins']()).toEqual([]);

    flowView['pickPreset']('desktop');
    await settle(fixture);

    expect(flowView['pins']().map((pin) => [pin.frameId, pin.label])).toEqual([['pages/library one', '1']]);
  });

  it('notes on a flow frame the comments and pointed notes made at another size, and shows a note only at its own', async () => {
    const fixture = await mount({ systemProduct: 'web', systemEntry: 'flow:sign-in' });
    const flowView = flowViewOf(fixture);
    const noteOf = (id: string) => flowView['notedFrames']().find((frame) => frame.id === id)?.note;
    const shownNotes = () => flowView['notes']().map((shown) => shown.id);

    expect([noteOf('pages/library one'), noteOf('pages/library empty')]).toEqual([
      '1 comment at another size',
      undefined,
    ]);
    expect(shownNotes()).toEqual(['n1']);

    flowView['pickPreset']('desktop');
    await settle(fixture);

    expect([noteOf('pages/library one'), noteOf('pages/library empty')]).toEqual([undefined, '1 note at another size']);
    expect(shownNotes()).toEqual([]);
  });

  it('turns comment mode on with C, ends note mode, and drafts a comment at the preset on a frame click', async () => {
    const fixture = await mount({ systemProduct: 'web', systemEntry: 'flow:sign-in' });
    const view = fixture.componentInstance;
    const flowRoot: HTMLElement = fixture.debugElement.query(By.directive(FlowViewComponent)).nativeElement;

    expect(flowRoot.querySelector('[title="Comment mode (C)"]')).not.toBeNull();

    view['toggleNotes']();
    view['handleCommentKey'](new KeyboardEvent('keydown', { key: 'c' }));
    await settle(fixture);

    expect(view['commentStore'].active()).toBe(true);
    expect(view['noteStore'].active()).toBe(false);

    flowViewOf(fixture)['pick']({ frameId: 'pages/library empty', point: { x: 4, y: 8 } });

    expect(view['commentStore'].draft()).toEqual({
      frameId: 'pages/library empty',
      place: { part: 'pages/library', state: 'empty', size: 'phone' },
      point: { x: 4, y: 8 },
    });
    expect(view['noteStore'].draft()).toBeNull();
  });

  it('opens the pin of a listed comment on the shown flow instead of leaving it', async () => {
    const fixture = await mount({ systemProduct: 'web', systemEntry: 'flow:sign-in' });

    flowViewOf(fixture)['pickPreset']('desktop');
    await settle(fixture);
    fixture.componentInstance['jumpTo']({ ...comment, number: 1 });
    await settle(fixture);

    const canvas: DesignCanvasComponent = fixture.debugElement.query(
      By.directive(DesignCanvasComponent),
    ).componentInstance;

    expect(fixture.componentInstance['selectedKey']()).toBe('flow:sign-in');
    expect(canvas.openPinId()).toBe(comment.id);
  });

  it('starts no free note on empty space in comment mode', async () => {
    const fixture = await mount({ systemProduct: 'web', systemEntry: 'flow:sign-in' });

    fixture.componentInstance['toggleComments']();
    flowViewOf(fixture)['startFreeNote']({ x: 10, y: 10 });

    expect(fixture.componentInstance['noteStore'].draft()).toBeNull();
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
    const shown = () => flowViewOf(fixture).flow().frames.length;

    expect(shown()).toBe(2);

    frames = flow.frames.slice(0, 1);
    streams.forEach((stream) => stream.dispatchEvent(new Event('flows')));
    await settle(fixture);

    expect(shown()).toBe(1);
  });

  it('shows the notes at start, hides them on "Show notes", and remembers that per product for the next start', async () => {
    const first = await mount({ systemProduct: 'web', systemEntry: 'flow:sign-in' });
    const host = (fixture: ComponentFixture<SystemViewComponent>) => fixture.nativeElement as HTMLElement;
    const toggle = host(first).querySelector<HTMLButtonElement>('[data-notes-shown]');

    expect(host(first).querySelector('[data-note="n1"]')).not.toBeNull();

    toggle?.click();
    await settle(first);

    expect(host(first).querySelector('[data-note="n1"]')).toBeNull();
    expect(host(first).querySelector('[data-note-marker]')).toBeNull();
    first.destroy();

    expect(rememberedView().notesShown).toEqual({ ' web': false });

    const second = await mount(JSON.parse(localStorage.getItem(KEY) ?? '{}'));

    expect(host(second).querySelector('[data-note="n1"]')).toBeNull();
    expect(host(second).querySelector('[data-notes-shown]')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('shows the notes again when note mode turns on, so a new note stays in view', async () => {
    const fixture = await mount({ systemProduct: 'web', systemEntry: 'flow:sign-in' });
    const host = fixture.nativeElement as HTMLElement;

    host.querySelector<HTMLButtonElement>('[data-notes-shown]')?.click();
    await settle(fixture);
    host.querySelector<HTMLButtonElement>('[data-note-mode]')?.click();
    await settle(fixture);

    expect(host.querySelector('[data-notes-shown]')?.getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('[data-note="n1"]')).not.toBeNull();
    expect(rememberedView().notesShown).toEqual({ ' web': true });
  });
});

describe('SystemViewComponent view context', () => {
  const sketch: ListedSketch = {
    target: 'elements/rating',
    status: 'ready',
    createdAt: '2026-10-27T10:00:00Z',
    decision: { kind: 'pick', variant: 'b', decidedAt: '2026-10-28T10:00:00Z' },
    product: 'web',
    layer: 'elements',
    name: 'rating',
    dir: '.ethlete/design/web/sketches/elements-rating',
    variants: ['a', 'b'],
    problems: [],
  };

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('EventSource', SilentEventSource);
    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/sketches')) return json({ sketches: [sketch], unreadable: [] });
      if (url.includes('/__design/flows')) return json({ flows: [], unreadable: [] });
      if (url.includes('/__design/system')) return json([PRODUCT]);
      if (url.includes('/__design/calls')) return json([]);
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });

      return new Promise(() => undefined);
    });
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('writes the product, the part and the clicked frame of a part, and clears them when the view goes', async () => {
    const fixture = await mount({ systemProduct: 'web', systemEntry: 'elements/rating' });
    const context = TestBed.runInInjectionContext(() => injectViewContext());
    const canvas = fixture.componentInstance.partCanvas();

    expect(context.context()).toEqual({
      product: 'web',
      part: 'elements/rating',
      partFile: '.ethlete/design/web/elements/rating/rating.ts',
      sketch: null,
      sketchDir: null,
      variant: null,
      picked: null,
      selection: null,
    });

    const frame = canvas?.frames()[0];

    canvas?.selectedId.set(frame?.id ?? null);
    await settle(fixture);

    expect(context.context().selection).toBe(frame?.label);

    fixture.destroy();

    expect(context.shown()).toBeNull();
  });

  it("writes the sketch, its directory, its part's file, the picked variant and the variant of the selected frame", async () => {
    const fixture = await mount({ systemProduct: 'web', systemEntry: 'sketch:elements/rating' });
    const context = TestBed.runInInjectionContext(() => injectViewContext());

    expect(context.context()).toEqual({
      product: 'web',
      part: 'elements/rating',
      partFile: '.ethlete/design/web/elements/rating/rating.ts',
      sketch: 'elements/rating',
      sketchDir: '.ethlete/design/web/sketches/elements-rating',
      variant: null,
      picked: 'b',
      selection: null,
    });

    const canvas: DesignCanvasComponent = fixture.debugElement
      .query(By.directive(SketchViewComponent))
      .query(By.directive(DesignCanvasComponent)).componentInstance;
    const frame = canvas.frames().find((candidate) => candidate.place?.sketch?.variant === 'a');

    canvas.selectedId.set(frame?.id ?? null);
    await settle(fixture);

    expect(frame).toBeDefined();
    expect(context.context().variant).toBe('a');

    fixture.destroy();

    expect(context.shown()).toBeNull();
  });
});
