import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { ListedComment, ListedPart, ListedProduct, ListedSketch } from '../../host/design';
import { STUDIO_LABELS } from '../i18n/studio-labels';
import { THEMES } from '../../themes';
import { injectCommentStore, provideCommentStore } from './comment-store';
import { SketchViewComponent, liveShotsOf } from './sketch-view.component';
import { waitsForPick } from './system-tree';
import { undecidedShotsOf } from './undecided-shots';

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
  tree: { layers: [] },
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
  targets: ['a', 'b'].map((variant) => ({ variant, states: ['default'], interactions: [], unchanged: [] })),
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

const confirmed = async (button: HTMLButtonElement | undefined, fixture: ComponentFixture<unknown>) => {
  button?.click();
  await fixture.whenStable();
  [...document.querySelectorAll<HTMLElement>('[data-sk-confirm]')].at(-1)?.click();
};

const discardConfirmed = (root: HTMLElement, fixture: ComponentFixture<unknown>) =>
  confirmed(buttonNamed(root, 'Verwerfen'), fixture);

const mergeButtons = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLButtonElement>('button')].filter(
    (button) => button.textContent?.trim() === STUDIO_LABELS.sketches.merge,
  );

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
      targets: SKETCH.variants.map((variant) => ({ variant, states, interactions: [], unchanged: [] })),
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
    root.querySelector<HTMLButtonElement>('[data-sk-folded] button')?.click();
    await settle(fixture);

    expect(root.querySelectorAll('[data-shot]').length).toBeGreaterThan(0);
    expect(root.querySelectorAll('iframe[data-state]').length).toBe(0);

    fixture.componentRef.setInput('sketch', ROUNDED);
    await settle(fixture);

    expect(root.querySelectorAll('iframe[data-state]').length).toBeGreaterThan(0);
  });

  it('asks no frame and no picture of a state before the full listing says it is shown, then only of the changed states', async () => {
    const states = ['default', 'hover'];
    const quick = {
      ...SKETCH,
      problems: undefined,
      targets: SKETCH.variants.map((variant) => ({ variant, states, interactions: [] })),
    } satisfies ListedSketch;
    const { fixture, root } = await render(quick, noComments, { ...CARD, states });
    root.querySelector<HTMLButtonElement>('[data-sk-folded] button')?.click();
    await settle(fixture);
    const asked = () =>
      [...root.querySelectorAll<HTMLIFrameElement | HTMLImageElement>('iframe[data-state], img[data-shot-picture]')]
        .map((element) => element.closest('[data-shot]')?.getAttribute('data-shot'))
        .sort();

    expect(root.querySelectorAll('[data-shot]').length).toBe(6);
    expect(asked()).toEqual([]);

    fixture.componentRef.setInput('sketch', {
      ...quick,
      problems: [],
      targets: quick.targets.map((target) => ({ ...target, unchanged: ['hover'] })),
    });
    await settle(fixture);
    root.querySelector<HTMLButtonElement>('[data-sk-folded] button')?.click();
    await settle(fixture);

    expect([...new Set(asked())]).toEqual(['a default', 'b default', 'current default']);
  });

  it('holds back a pending shot and every shot of a state that no row changes yet', () => {
    const row = (key: string, shots: [string, boolean | null][]) => ({
      key,
      width: null,
      shots: shots.map(([state, changed]) => ({ state, changed, src: '', picture: '' })),
    });

    expect([
      ...undecidedShotsOf([
        row('current', [
          ['x', false],
          ['y', false],
          ['z', false],
        ]),
        row('a', [
          ['x', true],
          ['y', false],
          ['z', false],
        ]),
        row('b', [
          ['x', null],
          ['y', null],
          ['z', false],
        ]),
      ]),
    ]).toEqual(['current y', 'a y', 'b x', 'b y']);
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

  it('shows the note of the open round as the question line', async () => {
    const { fixture, root } = await render(
      { ...ROUNDED, rounds: [ROUNDED.rounds[0]!, { key: 'r2', title: 'Second', note: 'Wo steht der Status?' }] },
      noComments,
    );

    expect(root.querySelector('[data-sk-question]')?.textContent?.trim()).toBe('Wo steht der Status?');

    (fixture.componentInstance as unknown as { pickRound: (key: string) => void }).pickRound('r1');
    await settle(fixture);

    expect(root.querySelector('[data-sk-question]')).toBeNull();
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

  it('asks to confirm Übernehmen and merges the variant only once confirmed', async () => {
    const bodies: Record<string, unknown> = {};
    const { fixture, root } = await render(SKETCH, (url, init) => {
      const path = ['sketch-decision', 'sketch-merge'].find((entry) => url.includes(`/__design/${entry}`));

      if (!path) return noComments(url);

      bodies[path] = JSON.parse(String(init?.body ?? '{}'));

      return json(path === 'sketch-merge' ? { merged: ['components/card'] } : {});
    });
    const completed: string[] = [];

    fixture.componentInstance.mergeComplete.subscribe((target) => completed.push(target));

    expect(mergeButtons(root)).toHaveLength(2);

    mergeButtons(root)[1]?.click();
    await settle(fixture);

    const dialog = [...document.querySelectorAll('[role="alertdialog"]')].at(-1);

    expect(dialog?.textContent).toContain(
      STUDIO_LABELS.sketches.mergeConfirm.question('Variante b', 'components/card'),
    );
    expect(root.querySelector('ethlete-sketches')).not.toBeNull();

    dialog?.querySelector<HTMLElement>('[data-sk-confirm-cancel]')?.click();
    await settle(fixture);

    expect(bodies).toEqual({});

    await confirmed(mergeButtons(root)[0], fixture);
    await settle(fixture);

    expect(bodies).toEqual({ 'sketch-decision': { kind: 'pick', variant: 'a' }, 'sketch-merge': {} });
    expect(completed).toEqual(['components/card']);
  });

  it('ignores a second merge while one runs', async () => {
    const requests: string[] = [];
    const { fixture } = await render(SKETCH, (url) => {
      if (url.includes('/__design/sketch-decision')) {
        requests.push('decision');

        return new Promise<Response>(() => undefined);
      }

      return noComments(url);
    });

    fixture.componentInstance['merge']('a');
    fixture.componentInstance['merge']('b');
    await settle(fixture);

    expect(requests).toEqual(['decision']);
  });

  it('shows a merge refusal and a merge failure in the head', async () => {
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
    const errorText = () => root.querySelector('ethlete-sketches [role="alert"]')?.textContent?.trim();
    const completed: string[] = [];
    const merge = async () => {
      await confirmed(mergeButtons(root)[0], fixture);
      await settle(fixture);
    };

    fixture.componentInstance.mergeComplete.subscribe((target) => completed.push(target));

    expect(errorText()).toBeUndefined();

    await merge();

    expect(errorText()).toBe(STUDIO_LABELS.merge.needsRebase(['components/card']));

    refusal = {
      status: 422,
      body: {
        error: 'the check failed after the merge',
        reason: 'check-failed',
        findings: ['INLINE-SVG components/title-bar/shared/chrome.ts: draws an <svg> inline'],
      },
    };
    await merge();

    expect(errorText()).toBe(
      'the check failed after the merge\nINLINE-SVG components/title-bar/shared/chrome.ts: draws an <svg> inline',
    );

    refusal = { status: 500, body: { error: 'boom' } };
    await merge();

    expect(errorText()).toBe('boom');
    expect(completed).toEqual([]);
  });

  it('names a not-ready sketch with the first line of its ready refusal, offers no merge and does not wait for a pick', async () => {
    const refused = {
      ...SKETCH,
      status: 'in progress' as const,
      decision: undefined,
      report: null,
      readyRefusal: {
        lines: ['pages/system b: SHOT-NOT-VIEWED listing-error', 'pages/system draws a pixel diff - view its shot'],
        round: 'r1',
        at: new Date().toISOString(),
      },
    };
    const { root } = await render(refused, noComments);

    expect(root.querySelector('header et-badge')?.textContent?.trim()).toBe(STUDIO_LABELS.sketches.status.notReady);
    expect(root.querySelector('[data-sk-not-ready]')?.textContent?.trim()).toBe(
      'pages/system b: SHOT-NOT-VIEWED listing-error',
    );
    expect(buttonNamed(root, STUDIO_LABELS.sketches.merge)).toBeUndefined();
    expect(waitsForPick(refused)).toBe(false);
  });

  it('names a ready, picked sketch whose files changed after ready as not ready and offers no merge', async () => {
    const changed = {
      ...SKETCH,
      status: 'ready' as const,
      decision: { kind: 'pick' as const, variant: 'a', decidedAt: new Date().toISOString() },
      report: null,
      readyRefusal: {
        lines: ['pages/sketches is picked (variant a) and a changed since sketch ready judged it'],
        round: 'r1',
        at: new Date().toISOString(),
      },
    };
    const { root } = await render(changed, noComments);

    expect(root.querySelector('header et-badge')?.textContent?.trim()).toBe(STUDIO_LABELS.sketches.status.notReady);
    expect(root.querySelector('[data-sk-not-ready]')?.textContent?.trim()).toBe(
      'pages/sketches is picked (variant a) and a changed since sketch ready judged it',
    );
    expect(buttonNamed(root, STUDIO_LABELS.sketches.merge)).toBeUndefined();
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

    expect(badgeOf(stalled.root)).toBe(status.notReady);
    expect(stalled.root.querySelector('[data-sk-not-ready]')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      `${STUDIO_LABELS.sketches.notReadyUnknown} · Letzte Änderung von Opus 5.5 · seit 40 Min`,
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

    expect(badgeOf(silent.root)).toBe(status.notReady);
    expect(buttonNamed(silent.root, STUDIO_LABELS.sketches.merge)).toBeUndefined();
    silent.fixture.destroy();

    const ready = await render({ ...SKETCH, decision: undefined }, noComments);

    expect(badgeOf(ready.root)).toBe(status.waiting);
    expect(buttonNamed(ready.root, STUDIO_LABELS.sketches.merge)).toBeDefined();
  });

  it('shows the agent line from the drawing report: who, its message, the variant and since when', async () => {
    const updatedAt = new Date(Date.now() - 7 * 60_000).toISOString();
    const { root } = await render(
      {
        ...SKETCH,
        status: 'in progress',
        decision: undefined,
        report: { message: 'baut Runde 3', updatedAt, variant: 'b', author: 'claude-sonnet-5-5' },
      },
      noComments,
    );
    const parts = [...(root.querySelector('[data-sk-agent]')?.children ?? [])].map((part) => part.textContent?.trim());

    expect(parts).toEqual(['', 'Sonnet 5.5', 'baut Runde 3', `· Variante b · ${STUDIO_LABELS.sketches.since(7)}`]);
  });

  it('shows the variant step of a report that names a state, and no agent line once the report stalls', async () => {
    const open = { ...SKETCH, status: 'in progress' as const, decision: undefined };
    const drawing = await render(
      {
        ...open,
        report: {
          message: 'Zustand reset-hover',
          updatedAt: new Date().toISOString(),
          variant: 'a',
          author: 'claude-opus-5-5',
        },
      },
      noComments,
    );

    expect(drawing.root.querySelector('[data-sk-agent]')?.textContent).toContain('Zustand reset-hover');
    expect(drawing.root.querySelector('[data-sk-agent]')?.textContent).toContain('Variante a');
    drawing.fixture.destroy();

    const stalled = await render(
      {
        ...open,
        report: {
          message: 'Zustand reset-hover',
          updatedAt: new Date(Date.now() - 60 * 60_000).toISOString(),
          variant: 'a',
          author: 'claude-opus-5-5',
        },
      },
      noComments,
    );

    expect(stalled.root.querySelector('[data-sk-agent]')).toBeNull();
  });

  it('shows a failed agent line and a failed head naming the round and the load error of each variant', async () => {
    const updatedAt = new Date(Date.now() - 50 * 60_000).toISOString();
    const { root } = await render(
      {
        ...SKETCH,
        decision: undefined,
        targets: [
          { variant: 'a', states: ['default'], interactions: [], error: 'tsc failed' },
          { variant: 'b', states: ['default'], interactions: [], error: 'tsc failed' },
        ],
        report: { message: 'baut', updatedAt, variant: 'b', author: 'claude-opus-5-5' },
      },
      noComments,
    );
    const line = root.querySelector('[data-sk-agent]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const labels = STUDIO_LABELS.sketches.agentRun;

    expect(line).toContain('Opus 5.5');
    expect(line).toContain(labels.errors(['a: tsc failed', 'b: tsc failed']));
    expect(line).toContain(labels.ago(50));
    expect(line).toMatch(/Runde (\d+ )?fehlgeschlagen/);
    expect(root.querySelector('header et-badge')?.textContent?.trim()).toBe(STUDIO_LABELS.sketches.status.failed);
    expect(root.querySelector('header [data-sk-failed]')?.textContent?.trim()).toBe('a: tsc failed (+1)');
    expect(buttonNamed(root, STUDIO_LABELS.sketches.merge)).toBeUndefined();
  });

  it('waits for a pick only once every live frame drew, and names the error of a frame that failed', async () => {
    const { fixture, root } = await render({ ...ROUNDED, decision: undefined, report: null }, noComments);
    const frames = [...root.querySelectorAll<HTMLIFrameElement>('iframe[data-state]')];
    const failing = frames.at(-1)!;
    const status = STUDIO_LABELS.sketches.status;
    const badge = () => root.querySelector('header et-badge')?.textContent?.trim();
    const report = async (frame: HTMLIFrameElement, extra: object = {}) => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: frame.contentWindow,
          data: { type: 'design-explore:height', height: 80, ...extra },
        }),
      );
      await settle(fixture);
    };

    expect(frames.length).toBeGreaterThan(0);
    expect(badge()).toBe(status.drawing);
    expect(buttonNamed(root, STUDIO_LABELS.sketches.merge)).toBeUndefined();

    for (const frame of frames.slice(0, -1)) await report(frame);
    await report(failing, { errored: true, error: 'design-explore: state "default" failed\nboom is not defined' });

    const variant = failing.dataset['variant'];

    expect(badge()).toBe(status.failed);
    expect(root.querySelector('header [data-sk-failed]')?.textContent?.trim()).toBe(
      `${variant} · default: boom is not defined`,
    );
    expect(root.querySelector('[data-sk-agent]')?.textContent).toContain(`${variant} · default: boom is not defined`);
    expect(buttonNamed(root, STUDIO_LABELS.sketches.merge)).toBeUndefined();

    await report(failing);

    expect(badge()).toBe(status.waiting);
    expect(buttonNamed(root, STUDIO_LABELS.sketches.merge)).toBeDefined();
  });

  it('shows no agent line while nothing draws and every variant rendered', async () => {
    const { root } = await render({ ...SKETCH, decision: undefined, report: null }, noComments);

    expect(root.querySelector('[data-sk-agent]')).toBeNull();
  });

  it('shows the port line from the port mark: the merged parts and since when', async () => {
    const at = new Date(Date.now() - 4 * 60_000).toISOString();
    const { root } = await render(
      {
        ...SKETCH,
        decision: undefined,
        report: null,
        portAfterMerge: { merged: ['elements/hero', 'elements/card'], parts: ['elements/hero'], reasons: [], at },
      },
      noComments,
    );
    const parts = [...(root.querySelector('[data-sk-merge-port]')?.children ?? [])].map((part) =>
      part.textContent?.trim(),
    );

    expect(parts).toEqual([
      '',
      STUDIO_LABELS.sketches.mergePort(['elements/hero', 'elements/card']),
      `· ${STUDIO_LABELS.sketches.since(4)}`,
    ]);
  });

  it('shows no port line without a port mark, even while the base is stale', async () => {
    const { root } = await render(
      { ...SKETCH, decision: undefined, report: null, staleBase: ['elements/hero'] },
      noComments,
    );

    expect(root.querySelector('[data-sk-merge-port]')).toBeNull();
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
          { kind: 'missing-motion', from: 'rest', to: 'hover' },
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

    await discardConfirmed(root, fixture);
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

    await discardConfirmed(root, fixture);
    await settle(fixture);

    expect(errorText()).toContain('is in progress - a variant is picked once it is ready');
    expect(fixture.componentInstance['busy']()).toBeNull();

    refuse = false;
    await discardConfirmed(root, fixture);
    await settle(fixture);

    expect(errorText()).toBeUndefined();

    refuse = true;
    await discardConfirmed(root, fixture);
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

  it('pins a resolved thread of a variant only after a jump to it, as resolved', async () => {
    const comment: ListedComment = {
      id: 'c2',
      part: 'components/card',
      state: 'default',
      size: 'fit',
      text: 'Done here',
      createdAt: '2026-10-27T11:00:00Z',
      replies: [],
      threadState: 'answered',
      stale: null,
      resolved: { by: 'user', resolvedAt: '2026-10-28T09:00:00Z' },
      sketch: { target: 'components/card', variant: 'b', createdAt: SKETCH.createdAt },
    };
    const { fixture, root } = await render(SKETCH, (url) =>
      url.includes('/__design/comments') ? json({ comments: [comment], unreadable: [] }) : noComments(url),
    );
    const pinButton = () => root.querySelector('[data-sk-row="b"] ethlete-comment-pin button');

    expect(pinButton()).toBeNull();

    fixture.componentInstance.jumpTo(comment);
    await settle(fixture);

    expect(pinButton()?.getAttribute('aria-label')).toBe('Comment by Du, resolved');
  });
});
