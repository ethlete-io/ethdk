import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { ListedPart, ListedProduct, ListedSketch } from '../../host/design';
import { STUDIO_LABELS } from '../i18n/studio-labels';
import { THEMES } from '../../themes';
import { injectCommentStore, provideCommentStore } from './comment-store';
import { SketchViewComponent, liveShotsOf } from './sketch-view.component';

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

class NearIntersectionObserver {
  public constructor(private callback: IntersectionObserverCallback) {}

  public observe(target: Element) {
    setTimeout(() =>
      this.callback(
        [{ target, isIntersecting: true, intersectionRatio: 1 } as unknown as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      ),
    );
  }

  public unobserve() {
    return undefined;
  }

  public disconnect() {
    return undefined;
  }

  public takeRecords() {
    return [];
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

const render = async (
  sketch: ListedSketch,
  fetch: (url: string, init?: RequestInit) => Promise<Response>,
  part: ListedPart = CARD,
) => {
  vi.stubGlobal('fetch', fetch);
  TestBed.runInInjectionContext(() => injectCommentStore()).connect(
    signal({ address: { port: 4402, product: 'web' }, revision: 0 }),
  );

  const fixture = TestBed.createComponent(SketchViewComponent);

  fixture.componentRef.setInput('port', 4402);
  fixture.componentRef.setInput('product', PRODUCT);
  fixture.componentRef.setInput('sketch', sketch);
  fixture.componentRef.setInput('part', part);
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

const LIST_WIDTH = 10000;

const configure = () =>
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideCommentStore(), ...provideColorThemesWithTailwind4(THEMES)],
  });

describe('SketchViewComponent', () => {
  // The cold JIT compile of the component tree takes seconds on a loaded CI runner; outside this hook it lands in the 5 s budget of the first case.
  beforeAll(() => {
    vi.stubGlobal('fetch', noComments);
    vi.stubGlobal('EventSource', SilentEventSource);
    vi.stubGlobal('ResizeObserver', SilentResizeObserver);
    vi.stubGlobal('IntersectionObserver', NearIntersectionObserver);
    configure();

    const fixture = TestBed.createComponent(SketchViewComponent);

    fixture.componentRef.setInput('port', 4402);
    fixture.componentRef.setInput('product', PRODUCT);
    fixture.componentRef.setInput('sketch', ROUNDED);
    fixture.componentRef.setInput('part', CARD);
    fixture.componentRef.setInput('cameraKey', 'web sketch:components/card');
    fixture.componentRef.setInput('shell', SHELL);
    fixture.detectChanges();
    fixture.destroy();
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    localStorage.clear();
  }, 30_000);

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('EventSource', SilentEventSource);
    vi.stubGlobal('ResizeObserver', SilentResizeObserver);
    vi.stubGlobal('IntersectionObserver', NearIntersectionObserver);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute('data-sk-rows') ? LIST_WIDTH : 0;
    });
    configure();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('draws the current page and the variants of the newest round, each as a live frame', async () => {
    const { root } = await render(ROUNDED, noComments);

    expect([...root.querySelectorAll('[data-sk-row]')].map((row) => row.getAttribute('data-sk-row'))).toEqual([
      'current',
      'b',
    ]);
    expect([
      ...new Set([...root.querySelectorAll('iframe')].map((frame) => new URL(frame.src).searchParams.get('variant'))),
    ]).toEqual([null, 'b']);
    expect(root.textContent).toContain('Calmer');
  });

  it('keeps at most six near cells live and the stored picture in every cell', async () => {
    const states = ['default', 'hover', 'focus'];
    const wide = {
      ...SKETCH,
      targets: SKETCH.variants.map((variant) => ({ variant, states, interactions: [] })),
    } satisfies ListedSketch;

    const { root } = await render(wide, noComments, { ...CARD, states });

    expect(root.querySelectorAll('[data-shot]').length).toBe(9);
    expect(root.querySelectorAll('iframe[data-state]').length).toBe(6);
    expect(root.querySelectorAll('iframe[data-state] + ethlete-frame-shield.pointer-events-auto').length).toBe(6);
    expect(root.querySelectorAll('img[data-shot-picture]').length).toBe(9);
  });

  it('shows a live frame over its picture only once its page painted', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => window.setTimeout(callback, 0));
    const { fixture, root } = await render(ROUNDED, noComments);
    const iframe = root.querySelector<HTMLIFrameElement>('iframe[data-state]')!;
    const picture = () => iframe.parentElement!.querySelector('img[data-shot-picture]')!;

    expect(iframe.classList).toContain('opacity-0');
    expect(picture().classList).not.toContain('opacity-0');

    window.dispatchEvent(
      new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'design-explore:painted' } }),
    );
    await settle(fixture);

    expect(iframe.classList).not.toContain('opacity-0');
    expect(picture().classList).toContain('opacity-0');
  });

  it('keeps a painted frame shown until the frame of a new revision paints, so a cell without a picture never goes empty', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => window.setTimeout(callback, 0));
    const { fixture, root } = await render(ROUNDED, noComments);
    const cell = root.querySelector<HTMLIFrameElement>('iframe[data-variant="b"]')!.parentElement!;
    const frames = () => [...cell.querySelectorAll<HTMLIFrameElement>('iframe')];
    const paint = async (frame: HTMLIFrameElement) => {
      window.dispatchEvent(
        new MessageEvent('message', { source: frame.contentWindow, data: { type: 'design-explore:painted' } }),
      );
      await settle(fixture);
    };
    const [old] = frames();

    await paint(old!);
    fixture.componentRef.setInput('revision', 1);
    await settle(fixture);

    const [kept, next] = frames();

    expect(kept).toBe(old);
    expect(kept!.classList).not.toContain('opacity-0');
    expect(next!.classList).toContain('opacity-0');
    expect(new URL(next!.src).searchParams.get('revision')).toBe('1');

    await paint(next!);

    expect(frames()).toEqual([next]);
    expect(next!.classList).not.toContain('opacity-0');
  });

  it('makes no frame live while the listing names the sketch without its targets', async () => {
    const { fixture, root } = await render({ ...ROUNDED, targets: undefined }, noComments);

    expect(root.querySelectorAll('[data-shot]').length).toBeGreaterThan(0);
    expect(root.querySelectorAll('iframe[data-state]').length).toBe(0);

    fixture.componentRef.setInput('sketch', ROUNDED);
    await settle(fixture);

    expect(root.querySelectorAll('iframe[data-state]').length).toBeGreaterThan(0);
  });

  it('lists the near keys in row order up to the cap', () => {
    expect(liveShotsOf({ order: ['a 1', 'a 2', 'b 1', 'b 2'], near: new Set(['b 2', 'a 2', 'b 1']), cap: 2 })).toEqual([
      'a 2',
      'b 1',
    ]);
  });

  it('keeps the frames of painted cells without a picture ahead of pictured cells', () => {
    expect(
      liveShotsOf({
        order: ['a 1', 'a 2', 'b 1', 'b 2'],
        near: new Set(['a 1', 'a 2', 'b 1', 'b 2']),
        cap: 2,
        pictured: new Set(['a 1', 'a 2']),
        painted: new Set(['a 1', 'b 2']),
      }),
    ).toEqual(['b 1', 'b 2']);
  });

  it('keeps the frame of a painted cell without a picture live after it leaves the near cells, until its picture loads', () => {
    const live = (pictured: string[]) =>
      liveShotsOf({
        order: ['a 1', 'a 2', 'b 1', 'b 2'],
        near: new Set(['b 1', 'b 2']),
        cap: 2,
        pictured: new Set(pictured),
        painted: new Set(['a 1', 'b 1']),
      });

    expect(live([])).toEqual(['a 1', 'b 1', 'b 2']);
    expect(live(['a 1'])).toEqual(['b 1', 'b 2']);
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

    expect(root.querySelector('[data-sk-row="a"]')).not.toBeNull();
    expect(root.querySelector('[data-sk-row="b"]')).toBeNull();
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

    expect(root.querySelector('[data-sk-row="c"]')).not.toBeNull();
    expect(root.querySelector('[data-sk-row="a"]')).toBeNull();
  });

  it('ignores the round flags remembered for an earlier sketch of the same part', async () => {
    localStorage.setItem(
      'ethlete-studio.call-view',
      JSON.stringify({
        sketchViews: { 'web sketch:components/card': { rounds: { r1: true }, roundsFor: '2026-10-20T10:00:00Z' } },
      }),
    );

    const { root } = await render(ROUNDED, noComments);

    expect(root.querySelector('[data-sk-row="b"]')).not.toBeNull();
  });

  it('opens the merge page from Übernehmen without picking the variant with the changed rows, now and after', async () => {
    const bodies: Record<string, unknown> = {};
    const home: ListedPart = { ...CARD, layer: 'pages', name: 'home' };
    const changed = { part: 'pages/home', state: 'default', outlines: { now: [], merged: [] } };
    const { fixture, root } = await render(SKETCH, (url, init) => {
      if (url.includes('/__design/sketch-preview')) return json({ changed: [], affected: ['pages/home'] });
      if (url.includes('/__design/sketch-compare'))
        return json({ target: SKETCH.target, variant: 'a', changed: [changed], unchanged: [] });

      const path = ['sketch-decision', 'sketch-merge'].find((entry) => url.includes(`/__design/${entry}`));

      if (!path) return noComments(url);

      bodies[path] = JSON.parse(String(init?.body ?? '{}'));

      return json(path === 'sketch-merge' ? { merged: ['components/card'] } : {});
    });
    const completed: string[] = [];

    fixture.componentRef.setInput('product', { ...PRODUCT, parts: [home] });
    fixture.componentInstance.mergeComplete.subscribe((target) => completed.push(target));
    await settle(fixture);

    const picks = [...root.querySelectorAll<HTMLButtonElement>('button')].filter(
      (button) => button.textContent?.trim() === STUDIO_LABELS.sketches.merge,
    );

    expect(picks).toHaveLength(2);

    picks[0]?.click();
    await settle(fixture);

    expect(bodies).toEqual({});
    expect(root.querySelector('ethlete-sketches')).toBeNull();
    expect(root.querySelector('ethlete-merge li')?.textContent).toContain('pages/home');

    const frames = [...root.querySelectorAll('ethlete-merge iframe')].map(
      (frame) => new URL(frame.getAttribute('src') ?? ''),
    );

    expect(frames.map((frame) => frame.searchParams.get('part'))).toEqual(['pages/home', 'pages/home']);
    expect(frames.map((frame) => frame.searchParams.get('variant'))).toEqual([null, 'a']);
    expect(root.querySelectorAll('ethlete-merge iframe + ethlete-frame-shield.pointer-events-auto').length).toBe(2);

    buttonNamed(root, STUDIO_LABELS.merge.back)?.click();
    await settle(fixture);

    expect(root.querySelector('ethlete-merge')).toBeNull();
    expect(root.querySelector('ethlete-sketches')).not.toBeNull();

    fixture.componentInstance['openMerge']('a');
    await settle(fixture);
    buttonNamed(root, 'Merge')?.click();
    await settle(fixture);

    expect(bodies).toEqual({ 'sketch-decision': { kind: 'pick', variant: 'a' }, 'sketch-merge': {} });
    expect(completed).toEqual(['components/card']);
  });

  it('groups the unchanged states of the merge page by part', async () => {
    const home: ListedPart = { ...CARD, layer: 'pages', name: 'home' };
    const changed = { part: 'pages/home', state: 'default', outlines: { now: [], merged: [] } };
    const unchanged = [
      { part: 'pages/home', state: 'empty' },
      { part: 'pages/inbox', state: 'all' },
      { part: 'pages/home', state: 'wide' },
    ];
    const { fixture, root } = await render(SKETCH, (url) => {
      if (url.includes('/__design/sketch-preview')) return json({ changed: ['pages/home'], affected: [] });
      if (url.includes('/__design/sketch-compare'))
        return json({ target: SKETCH.target, variant: 'a', changed: [changed], unchanged });

      return noComments(url);
    });

    fixture.componentRef.setInput('product', { ...PRODUCT, parts: [home] });
    await settle(fixture);
    fixture.componentInstance['openMerge']('a');
    await settle(fixture);

    const labels = [...root.querySelectorAll('ethlete-merge ethlete-disclosure button')].map((button) =>
      button.textContent?.trim(),
    );

    expect(labels).toEqual([
      STUDIO_LABELS.merge.unchanged(2, 'pages/home'),
      STUDIO_LABELS.merge.unchanged(1, 'pages/inbox'),
    ]);
  });

  it('compares a merge that changes only the sketched page, and draws a state only the variant has after the merge', async () => {
    const home: ListedPart = { ...CARD, layer: 'pages', name: 'home' };
    const added = { part: 'pages/home', state: 'added', missing: 'now', outlines: { now: [], merged: [] } };
    const { fixture, root } = await render(SKETCH, (url) => {
      if (url.includes('/__design/sketch-preview')) return json({ changed: ['pages/home'], affected: [] });
      if (url.includes('/__design/sketch-compare'))
        return json({ target: SKETCH.target, variant: 'a', changed: [added], unchanged: [] });
      if (url.includes('/__design/sketch-decision')) return json({});

      return noComments(url);
    });

    fixture.componentRef.setInput('product', { ...PRODUCT, parts: [home] });
    await settle(fixture);
    fixture.componentInstance['openMerge']('a');
    await settle(fixture);

    expect(root.querySelector('ethlete-merge li')?.textContent).toContain('pages/home');

    const frames = [...root.querySelectorAll('ethlete-merge iframe')].map(
      (frame) => new URL(frame.getAttribute('src') ?? ''),
    );

    expect(frames.map((frame) => [frame.searchParams.get('state'), frame.searchParams.get('variant')])).toEqual([
      ['added', 'a'],
    ]);
  });

  it('lets a running compare finish when the frames redraw meanwhile, and compares again on a later redraw', async () => {
    const home: ListedPart = { ...CARD, layer: 'pages', name: 'home' };
    const changed = { part: 'pages/home', state: 'default', outlines: { now: [], merged: [] } };
    const answers: (() => void)[] = [];
    const { fixture, root } = await render(SKETCH, (url) => {
      if (url.includes('/__design/sketch-preview')) return json({ changed: [], affected: ['pages/home'] });
      if (url.includes('/__design/sketch-compare'))
        return new Promise<Response>((done) =>
          answers.push(() => done(json({ target: SKETCH.target, variant: 'a', changed: [changed], unchanged: [] }))),
        );
      if (url.includes('/__design/sketch-decision')) return json({});

      return noComments(url);
    });

    fixture.componentRef.setInput('product', { ...PRODUCT, parts: [home] });
    await settle(fixture);
    fixture.componentInstance['openMerge']('a');
    await settle(fixture);

    expect(answers).toHaveLength(1);

    fixture.componentRef.setInput('sketch', { ...SKETCH });
    await settle(fixture);
    fixture.componentRef.setInput('revision', 1);
    await settle(fixture);
    fixture.componentRef.setInput('revision', 2);
    await settle(fixture);
    answers[0]?.();
    await settle(fixture);

    expect(root.querySelector('ethlete-merge li')?.textContent).toContain('pages/home');
    expect(answers).toHaveLength(1);

    fixture.componentRef.setInput('revision', 3);
    await settle(fixture);

    expect(answers).toHaveLength(2);
  });

  it('crops the changed instance on each side and labels the state a variant adds', async () => {
    const home: ListedPart = { ...CARD, layer: 'pages', name: 'home' };
    const rect = { x: 40, y: 80, width: 120, height: 32 };
    const changed = { part: 'pages/home', state: 'default', outlines: { now: [rect], merged: [rect] } };
    const added = { part: 'pages/home', state: 'added', missing: 'now', outlines: { now: [], merged: [rect] } };
    const { fixture, root } = await render(SKETCH, (url) => {
      if (url.includes('/__design/sketch-preview')) return json({ changed: [], affected: ['pages/home'] });
      if (url.includes('/__design/sketch-compare'))
        return json({ target: SKETCH.target, variant: 'a', changed: [changed, added], unchanged: [] });
      if (url.includes('/__design/sketch-decision')) return json({});

      return noComments(url);
    });
    const framesOf = () =>
      [...root.querySelectorAll('ethlete-merge iframe')].map((frame) => {
        const src = new URL(frame.getAttribute('src') ?? '');

        return [src.searchParams.get('state'), src.searchParams.get('variant')];
      });

    fixture.componentRef.setInput('product', { ...PRODUCT, parts: [home] });
    await settle(fixture);
    fixture.componentInstance['openMerge']('a');
    await settle(fixture);

    expect(root.textContent).not.toContain(STUDIO_LABELS.system.copyPrompt);
    expect(framesOf()).toEqual([
      ['default', null],
      ['default', 'a'],
      ['default', null],
      ['default', 'a'],
    ]);

    fixture.componentInstance['pickRow']('pages/home added');
    await settle(fixture);

    expect(root.querySelector('ethlete-merge figure')?.textContent).toContain(STUDIO_LABELS.merge.addedIn('a'));
    expect(framesOf()).toEqual([
      ['added', 'a'],
      ['added', 'a'],
    ]);
  });

  it('shows the Merge button loading while the merge runs and ignores a second click', async () => {
    const requests: string[] = [];
    const { fixture, root } = await render(SKETCH, (url) => {
      if (url.includes('/__design/sketch-decision')) {
        requests.push('decision');

        return new Promise<Response>(() => undefined);
      }

      return noComments(url);
    });

    fixture.componentInstance['openMerge']('a');
    await settle(fixture);
    buttonNamed(root, 'Merge')?.click();
    await settle(fixture);

    const merge = buttonNamed(root, 'Merge');

    expect(merge?.getAttribute('aria-busy')).toBe('true');

    merge?.click();
    await settle(fixture);

    expect(requests).toEqual(['decision']);
  });

  it('shows a merge refusal and a merge failure under the Merge button', async () => {
    let refusal: { status: number; body: unknown } = {
      status: 422,
      body: { error: 'stale', changed: ['components/card'], rebase: 'design sketch rebase' },
    };
    const { fixture, root } = await render(SKETCH, (url) => {
      if (url.includes('/__design/sketch-merge'))
        return Promise.resolve(new Response(JSON.stringify(refusal.body), { status: refusal.status }));
      if (url.includes('/__design/sketch-decision')) return json({});

      return noComments(url);
    });
    const errorText = () => root.querySelector('ethlete-merge [role="alert"]')?.textContent?.trim();
    const completed: string[] = [];

    fixture.componentInstance.mergeComplete.subscribe((target) => completed.push(target));
    fixture.componentInstance['openMerge']('a');
    await settle(fixture);

    expect(errorText()).toBeUndefined();

    buttonNamed(root, 'Merge')?.click();
    await settle(fixture);

    expect(errorText()).toBe(STUDIO_LABELS.merge.needsRebase(['components/card']));

    refusal = {
      status: 422,
      body: {
        error: 'the check failed after the merge',
        reason: 'check-failed',
        findings: ['INLINE-SVG components/title-bar/shared/chrome.ts: draws an <svg> inline'],
      },
    };
    buttonNamed(root, 'Merge')?.click();
    await settle(fixture);

    expect(errorText()).toBe(
      'the check failed after the merge\nINLINE-SVG components/title-bar/shared/chrome.ts: draws an <svg> inline',
    );

    refusal = { status: 500, body: { error: 'boom' } };
    buttonNamed(root, 'Merge')?.click();
    await settle(fixture);

    expect(errorText()).toBe('boom');
    expect(completed).toEqual([]);
  });

  it('derives the head badge from the drawing report and readiness, never from the sketch status alone', async () => {
    const badgeOf = (root: HTMLElement) => root.querySelector('header et-badge')?.textContent?.trim();
    const fresh = new Date(Date.now() - 5 * 60_000).toISOString();
    const stale = new Date(Date.now() - 40 * 60_000).toISOString();
    const open = { ...SKETCH, status: 'in progress' as const, decision: undefined };
    const status = STUDIO_LABELS.sketches.status;

    const drawing = await render(
      { ...open, report: { message: 'zeichnet', updatedAt: fresh, variant: 'b', author: 'claude-opus-5-5' } },
      noComments,
    );

    expect(badgeOf(drawing.root)).toBe(status.drawing);
    expect(buttonNamed(drawing.root, STUDIO_LABELS.sketches.merge)).toBeUndefined();
    drawing.fixture.destroy();

    const stalled = await render(
      { ...open, report: { message: 'zeichnet', updatedAt: stale, variant: 'b', author: 'claude-opus-5-5' } },
      noComments,
    );

    expect(badgeOf(stalled.root)).toBe(status.idle);
    expect(stalled.root.querySelector('header')?.textContent).toContain(
      STUDIO_LABELS.sketches.lastChange('Opus 5.5', STUDIO_LABELS.sketches.since(40)),
    );
    stalled.fixture.destroy();

    const silent = await render(
      {
        ...open,
        report: null,
        variantInfo: { a: { authors: ['claude-sonnet-5-5'] }, b: { authors: ['claude-opus-5-5'] } },
      },
      noComments,
    );
    const silentHead = silent.root.querySelector('header')?.textContent ?? '';

    expect(badgeOf(silent.root)).toBe(status.idle);
    expect(silentHead).toContain('Letzte Änderung von Opus 5.5');
    expect(silentHead).not.toContain(' · ');
    silent.fixture.destroy();

    const unknown = await render({ ...open, report: null }, noComments);

    expect(unknown.root.querySelector('header')?.textContent).not.toContain('Letzte Änderung');
    unknown.fixture.destroy();

    const ready = await render({ ...SKETCH, decision: undefined }, noComments);

    expect(badgeOf(ready.root)).toBe(status.waiting);
    expect(buttonNamed(ready.root, STUDIO_LABELS.sketches.merge)).toBeDefined();
  });

  it('shows a pick the rules refuse as picked, with the sketch points in the head of the picked variant of a sketch-only part', async () => {
    const asked: string[] = [];
    const sketch: ListedSketch = {
      ...SKETCH,
      target: 'elements/rating',
      variants: ['a', 'b', 'c'],
      decision: { kind: 'pick', variant: 'c', decidedAt: '2026-10-27T10:00:00Z' },
      problems: [{ variant: 'c', problems: [{ file: 'c.ts', rule: 'UTILITY-CSS', message: 'flex' }] }],
    };
    const fetch = (url: string) => {
      if (!url.includes('/__design/open-points')) return noComments(url);
      asked.push(new URL(url).searchParams.get('part') ?? '');

      return json({
        points: [
          { kind: 'unmerged-sketch', status: 'ready', decision: 'pick' },
          { kind: 'sketch-problem', sketch: 'elements/rating', variant: 'c', rule: 'UTILITY-CSS', message: 'flex' },
          { kind: 'sketch-problem', sketch: 'elements/rating', variant: 'c', rule: 'UTILITY-CSS', message: 'gap' },
          { kind: 'contrast', state: 'hover', path: 'label' },
        ],
        buildReady: { ready: false, blockers: [{ kind: 'pending', text: 'pending' }] },
      });
    };

    const { root } = await render(sketch, fetch, null as unknown as ListedPart);
    const chip = root.querySelector('[data-selected] [data-sk-points] [data-open-points-chip]');

    const badges = [...root.querySelectorAll('header et-badge')].map((badge) => badge.textContent?.trim());

    expect(badges).toContain(STUDIO_LABELS.sketches.status.picked);
    expect(badges).not.toContain(STUDIO_LABELS.sketches.status.waiting);
    expect(asked).toEqual(['elements/rating']);
    expect(chip?.textContent?.trim()).toBe(STUDIO_LABELS.system.openCount(3));
    expect(root.querySelectorAll('[data-sk-points]')).toHaveLength(1);
    expect(chip?.closest('[data-sk-points]')?.parentElement?.querySelector('[data-sk-merge]')).not.toBeNull();
  });

  it('shows a held sketch as paused with what it waits on, who held it and since when', async () => {
    const heldAt = new Date(Date.now() - 7 * 60_000).toISOString();
    const { root } = await render(
      {
        ...SKETCH,
        status: 'in progress',
        decision: undefined,
        report: null,
        hold: { until: 'B99 und B100', by: 'claude-sonnet-5-5', heldAt },
      },
      noComments,
    );

    expect(root.querySelector('header et-badge')?.textContent?.trim()).toBe(STUDIO_LABELS.sketches.status.paused);
    expect(buttonNamed(root, STUDIO_LABELS.sketches.merge)).toBeUndefined();

    root.querySelector<HTMLButtonElement>('[data-sk-hold]')?.click();
    await new Promise((done) => setTimeout(done));

    const reason = root.querySelector('[data-sk-hold-reason]')?.textContent ?? '';

    expect(reason).toContain(STUDIO_LABELS.sketches.holdUntil('B99 und B100'));
    expect(reason).toContain('Sonnet 5.5');
    expect(reason).toContain(STUDIO_LABELS.sketches.since(7));
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

  it('shows the reason of a refused discard next to the decide controls and clears it on the next action', async () => {
    const reason = 'components/card is in progress - a variant is picked once it is ready';
    let refuse = true;
    const { fixture, root } = await render(SKETCH, (url) => {
      if (url.includes('/__design/sketch-decision') || url.includes('/__design/sketch-discard'))
        return Promise.resolve(
          refuse ? new Response(JSON.stringify({ error: reason }), { status: 422 }) : new Response('{}'),
        );

      return noComments(url);
    });
    const errorText = () => root.querySelector('ethlete-sketches [role="alert"]')?.textContent?.trim();

    buttonNamed(root, 'Verwerfen')?.click();
    await settle(fixture);

    expect(errorText()).toContain('is in progress - a variant is picked once it is ready');
    expect(fixture.componentInstance['busy']()).toBeNull();

    refuse = false;
    buttonNamed(root, 'Verwerfen')?.click();
    await settle(fixture);

    expect(errorText()).toBeUndefined();

    refuse = true;
    buttonNamed(root, 'Verwerfen')?.click();
    await settle(fixture);

    expect(errorText()).toContain('is in progress');
    expect(fixture.componentInstance['busy']()).toBeNull();
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
    const pin = root.querySelector('[data-sk-row="b"] ethlete-comment-pin');

    expect(pin?.textContent).toContain('2');
    expect(root.querySelector('[data-sk-row="a"] ethlete-comment-pin')).toBeNull();
  });
});
