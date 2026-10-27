import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListedComment, ListedPart, ListedProduct } from '../../host/design';
import { CanvasFrame } from '../components/design-canvas/canvas-frame';
import { Camera } from '../components/design-canvas/canvas-math';
import { rememberedView } from '../studio-view/remembered';
import { SystemViewComponent } from './system-view.component';

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
});
