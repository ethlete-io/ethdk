import { WritableSignal, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ListedComment, ListedPart, ListedProduct, ListedSketch } from '../../host/design';
import { CanvasFrame } from '../components/design-canvas/canvas-frame';
import { Camera } from '../components/design-canvas/canvas-math';
import { rememberedView } from '../studio-view/remembered';
import { SketchViewComponent } from './sketch-view.component';
import { SystemViewComponent } from './system-view.component';

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

  it('counts no comment of another interaction in the part table, where each interaction has its own frame', async () => {
    const fixture = await mount({ systemProduct: 'web', systemEntry: 'elements/rating' });
    const frames: CanvasFrame[] = fixture.componentInstance['notedFrames']();

    expect(frames.map((frame) => [frame.place?.interaction ?? 'rest', frame.note])).toEqual([
      ['rest', undefined],
      ['hover', undefined],
    ]);
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
});
