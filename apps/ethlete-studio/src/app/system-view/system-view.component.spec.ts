import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListedComment, ListedPart, ListedProduct } from '../../host/design';
import { CanvasFrame } from '../components/design-canvas/canvas-frame';
import { Camera } from '../components/design-canvas/canvas-math';
import { rememberedView } from '../studio-view/remembered';
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
      cameras: { 'web sketch:elements/rating': SKETCH_CAMERA },
    });

    fixture.componentInstance['rememberCamera']({ x: 0, y: 0, zoom: 1 });

    expect(rememberedView().cameras).toEqual({
      'web sketch:elements/rating': SKETCH_CAMERA,
      'web foundations/tokens': { x: 0, y: 0, zoom: 1 },
    });
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
