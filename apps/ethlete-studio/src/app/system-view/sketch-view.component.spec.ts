import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { ListedPart, ListedProduct, ListedSketch } from '../../host/design';
import { THEMES } from '../../themes';
import { injectCommentStore, provideCommentStore } from './comment-store';
import { SketchViewComponent } from './sketch-view.component';

const PRODUCT: ListedProduct = { name: 'web', base: null, presets: {}, parts: [], problems: [] };

const SKETCH: ListedSketch = {
  target: 'components/card',
  status: 'ready',
  createdAt: '2026-10-27T10:00:00Z',
  decision: { kind: 'pick', variant: 'b', decidedAt: '2026-10-27T10:00:00Z' },
  product: 'web',
  layer: 'components',
  name: 'card',
  dir: 'card',
  variants: ['a', 'b'],
  problems: [],
};

const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body)));

class SilentResizeObserver {
  public observe() {
    return undefined;
  }

  public unobserve() {
    return undefined;
  }

  public disconnect() {
    return undefined;
  }
}

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

const settle = async (fixture: ComponentFixture<SketchViewComponent>) => {
  for (let round = 0; round < 5; round++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
};

const SHELL = {
  tree: [],
  product: 'web',
  products: ['web'],
  project: 'ethlete-sdk',
  projects: ['ethlete-sdk'],
  panel: 'open' as const,
};

const ROUNDED = {
  ...SKETCH,
  rounds: [
    { key: 'r1', title: 'First', note: '' },
    { key: 'r2', title: 'Second', note: '' },
  ],
  variantInfo: { a: { round: 'r1' }, b: { round: 'r2', note: 'Calmer' } },
  targets: ['a', 'b'].map((variant) => ({ variant, states: ['default'], interactions: [] })),
} satisfies ListedSketch;

const CARD: ListedPart = {
  layer: 'components',
  name: 'card',
  origin: 'product',
  note: null,
  states: ['default'],
  problems: [],
};

const render = async (sketch: ListedSketch, fetch: (url: string, init?: RequestInit) => Promise<Response>) => {
  vi.stubGlobal('fetch', fetch);
  TestBed.runInInjectionContext(() => injectCommentStore()).connect(
    signal({ address: { port: 4402, product: 'web' }, revision: 0 }),
  );

  const fixture = TestBed.createComponent(SketchViewComponent);

  fixture.componentRef.setInput('port', 4402);
  fixture.componentRef.setInput('product', PRODUCT);
  fixture.componentRef.setInput('sketch', sketch);
  fixture.componentRef.setInput('part', CARD);
  fixture.componentRef.setInput('cameraKey', 'web sketch:components/card');
  fixture.componentRef.setInput('shell', SHELL);
  fixture.autoDetectChanges();
  await settle(fixture);

  return { fixture, root: fixture.nativeElement as HTMLElement };
};

const noComments = (url: string) =>
  url.includes('/__design/comments') ? json({ comments: [], unreadable: [] }) : new Promise<Response>(() => undefined);

const buttonNamed = (root: HTMLElement, name: string) =>
  [...root.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.trim() === name);

describe('SketchViewComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('EventSource', SilentEventSource);
    vi.stubGlobal('ResizeObserver', SilentResizeObserver);
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideCommentStore(), ...provideColorThemesWithTailwind4(THEMES)],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('draws the current page and the variants of the newest round, each as a live frame', async () => {
    const { root } = await render(ROUNDED, noComments);

    expect([...root.querySelectorAll('[data-page]')].map((page) => page.getAttribute('data-page'))).toEqual([
      'current',
      'b',
    ]);
    expect([...root.querySelectorAll('iframe')].map((frame) => new URL(frame.src).searchParams.get('variant'))).toEqual(
      [null, 'b'],
    );
    expect(root.textContent).toContain('Calmer');
  });

  it('switches the round from the select, remembers it, and follows a new round', async () => {
    const { fixture, root } = await render(ROUNDED, noComments);
    const component = fixture.componentInstance as unknown as {
      rounds: () => { value: string; label: string }[];
      pickRound: (key: string) => void;
    };

    expect(component.rounds().map((round) => round.label)).toEqual(['Runde 1 · First', 'Runde 2 · Second']);

    component.pickRound('r1');
    await settle(fixture);

    expect(root.querySelector('[data-page="a"]')).not.toBeNull();
    expect(root.querySelector('[data-page="b"]')).toBeNull();
    expect(JSON.parse(localStorage.getItem('ethlete-studio.call-view') ?? '{}').sketchViews).toEqual({
      'web sketch:components/card': { rounds: { r1: true, r2: false }, roundsFor: SKETCH.createdAt },
    });

    fixture.componentRef.setInput('sketch', {
      ...ROUNDED,
      variants: ['a', 'b', 'c'],
      rounds: [...ROUNDED.rounds, { key: 'r3', title: 'Third', note: '' }],
      variantInfo: { ...ROUNDED.variantInfo, c: { round: 'r3' } },
    });
    await settle(fixture);

    expect(root.querySelector('[data-page="c"]')).not.toBeNull();
    expect(root.querySelector('[data-page="a"]')).toBeNull();
  });

  it('ignores the round flags remembered for an earlier sketch of the same part', async () => {
    localStorage.setItem(
      'ethlete-studio.call-view',
      JSON.stringify({
        sketchViews: { 'web sketch:components/card': { rounds: { r1: true }, roundsFor: '2026-10-20T10:00:00Z' } },
      }),
    );

    const { root } = await render(ROUNDED, noComments);

    expect(root.querySelector('[data-page="b"]')).not.toBeNull();
  });

  it('picks and merges a variant from its Merge button, without a note', async () => {
    const bodies: Record<string, unknown> = {};
    const { fixture, root } = await render(SKETCH, (url, init) => {
      const path = ['sketch-decision', 'sketch-merge'].find((entry) => url.includes(`/__design/${entry}`));

      if (!path) return noComments(url);

      bodies[path] = JSON.parse(String(init?.body ?? '{}'));

      return json(path === 'sketch-merge' ? { merged: ['components/card'] } : {});
    });
    const completed: string[] = [];

    fixture.componentInstance.mergeComplete.subscribe((target) => completed.push(target));
    await settle(fixture);

    const merges = [...root.querySelectorAll<HTMLButtonElement>('button')].filter(
      (button) => button.textContent?.trim() === 'Merge',
    );

    expect(merges).toHaveLength(2);

    merges[0]?.click();
    await settle(fixture);

    expect(bodies).toEqual({ 'sketch-decision': { kind: 'pick', variant: 'a' }, 'sketch-merge': {} });
    expect(completed).toEqual(['components/card']);
  });

  it('discards the sketch from Verwerfen', async () => {
    const asked: string[] = [];
    const { fixture, root } = await render(SKETCH, (url) => {
      asked.push(url);

      return url.includes('/__design/sketch-discard') ? json({}) : noComments(url);
    });

    buttonNamed(root, 'Verwerfen')?.click();
    await settle(fixture);

    expect(asked.some((url) => url.includes('/__design/sketch-discard'))).toBe(true);
  });

  it('pins the comments of a variant on its frame with the count of every message', async () => {
    const comment = {
      id: 'c1',
      part: 'components/card',
      state: 'default',
      size: 'fit',
      text: 'Too loud',
      createdAt: '2026-10-27T11:00:00Z',
      replies: [{ by: 'agent', author: 'claude-opus-5-5', text: 'Calmer now', createdAt: '2026-10-27T12:00:00Z' }],
      threadState: 'open',
      stale: null,
      sketch: { target: 'components/card', variant: 'b', createdAt: SKETCH.createdAt },
    };
    const { root } = await render(SKETCH, (url) =>
      url.includes('/__design/comments') ? json({ comments: [comment], unreadable: [] }) : noComments(url),
    );
    const pin = root.querySelector('[data-page="b"] ethlete-comment-pin');

    expect(pin?.textContent).toContain('2');
    expect(root.querySelector('[data-page="a"] ethlete-comment-pin')).toBeNull();
  });
});
