import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { ListedComment, ListedPart, ListedProduct, ListedSketch } from '../../host/design';
import { SKETCHES_LABELS, MERGE_LABELS } from '../i18n/sketches-labels';
import { SYSTEM_LABELS } from '../i18n/system-labels';
import { THEMES } from '../../themes';
import { injectCommentStore, provideCommentStore } from './comment-store';
import { SketchViewComponent, frameFitsCell, liveShotsOf, nearShotsOf } from './sketch-view.component';
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
  part: ListedPart | null = CARD,
  product: ListedProduct = PRODUCT,
) => {
  vi.stubGlobal('fetch', fetch);
  TestBed.runInInjectionContext(() => injectCommentStore()).connect(
    signal({ address: { port: 4402, product: 'web' }, revision: 0 }),
  );

  const fixture = TestBed.createComponent(SketchViewComponent);

  fixture.componentRef.setInput('port', 4402);
  fixture.componentRef.setInput('product', product);
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
  [...root.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => (button.getAttribute('aria-label') ?? button.textContent?.trim()) === name,
  );

const confirmed = async (button: HTMLButtonElement | undefined, fixture: ComponentFixture<unknown>) => {
  button?.click();
  await fixture.whenStable();
  [...document.querySelectorAll<HTMLElement>('[data-sk-confirm]')].at(-1)?.click();
};

const discardConfirmed = (root: HTMLElement, fixture: ComponentFixture<unknown>) =>
  confirmed(buttonNamed(root, 'Verwerfen'), fixture);

const mergeButtons = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLButtonElement>('button')].filter(
    (button) => button.textContent?.trim() === SKETCHES_LABELS.merge,
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
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1000, 1000));
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

  // The sketch view shows one round at a time and opens the newest.
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

  // The sketch view has no reject control, so a human comments or picks.
  it('draws no reject button on a variant', async () => {
    const { root } = await render(ROUNDED, noComments);
    const names = [...root.querySelectorAll('button')].map(
      (button) => `${button.getAttribute('aria-label') ?? ''} ${button.textContent ?? ''}`,
    );

    expect(names.filter((name) => /ablehn|reject/i.test(name))).toEqual([]);
  });

  it('keeps at most twelve near cells live and the stored picture in every cell', async () => {
    const states = ['default', 'hover', 'focus', 'active', 'disabled'];
    const wide = {
      ...SKETCH,
      targets: SKETCH.variants.map((variant) => ({ variant, states, interactions: [], unchanged: [] })),
    } satisfies ListedSketch;

    const { root } = await render(wide, noComments, { ...CARD, states });

    expect(root.querySelectorAll('[data-shot]').length).toBe(15);
    expect(root.querySelectorAll('iframe[data-state]').length).toBe(12);
    expect(root.querySelectorAll('iframe[data-state] + ethlete-frame-shield.pointer-events-auto').length).toBe(12);
    expect(root.querySelectorAll('img[data-shot-picture]').length).toBe(15);
  });

  it('sizes a picture-only cell from its picture ratio at its own width, not the narrowest width', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(168);
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(287);

    const drawn = {
      ...SKETCH,
      targets: SKETCH.variants.map((variant) => ({ variant, states: ['default'], interactions: [], unchanged: [] })),
    } satisfies ListedSketch;
    const { fixture, root } = await render(drawn, noComments, { ...CARD, widths: [112, 168] });

    root.querySelectorAll('img[data-shot-picture]').forEach((picture) => picture.dispatchEvent(new Event('load')));
    await settle(fixture);

    const shots = (fixture.componentInstance['rows']() as { shots: { width?: number; height: number }[] }[]).flatMap(
      (row) => row.shots,
    );

    expect(shots.filter((shot) => shot.width === 168).map((shot) => shot.height)).toEqual([287, 287, 287]);
    expect(shots.filter((shot) => shot.width === undefined).map((shot) => shot.height)).toEqual([191, 191, 191]);
  });

  it('shows no picture of the sketch opened before while the pictures of the next sketch load', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(390);
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(844);

    const sketchOf = (name: string, states: string[]) =>
      ({
        ...SKETCH,
        target: `elements/${name}`,
        layer: 'elements',
        name,
        dir: `elements-${name}`,
        variants: ['a', 'b', 'c'],
        decision: undefined,
        rounds: [{ key: 'r1', title: 'Rahmen der App', note: '' }],
        variantInfo: { a: { round: 'r1' }, b: { round: 'r1' }, c: { round: 'r1' } },
        targets: ['a', 'b', 'c'].map((variant) => ({ variant, states, interactions: [], unchanged: [] })),
      }) satisfies ListedSketch;
    const { fixture, root } = await render(sketchOf('hero', ['default', 'phone']), noComments, null);

    root.querySelectorAll('img[data-shot-picture]').forEach((picture) => picture.dispatchEvent(new Event('load')));
    await settle(fixture);

    fixture.componentRef.setInput('sketch', sketchOf('shell-app', ['desktop', 'phone']));
    await settle(fixture);

    const phone = root.querySelector('[data-shot="a phone"]')!;

    expect([...phone.querySelectorAll('img')].map((picture) => picture.getAttribute('src'))).not.toContainEqual(
      expect.stringContaining('hero'),
    );
    expect(fixture.componentInstance['loadingShots']().has('a phone')).toBe(true);
  });

  it('draws a picture narrower than its cell at its own size, so every cell shows the part at one scale', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(71);
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(71);

    const drawn = {
      ...SKETCH,
      targets: SKETCH.variants.map((variant) => ({
        variant,
        states: ['icon-filled'],
        interactions: [],
        unchanged: [],
      })),
    } satisfies ListedSketch;
    const { fixture, root } = await render(drawn, noComments, { ...CARD, widths: [111] });

    root.querySelectorAll('img[data-shot-picture]').forEach((picture) => picture.dispatchEvent(new Event('load')));
    await settle(fixture);

    const rows = fixture.componentInstance['rows']() as { width: number; shots: { height: number }[] }[];

    expect(rows.map((row) => [row.width, ...row.shots.map((shot) => shot.height)])).toEqual(rows.map(() => [111, 71]));
    expect(
      [...root.querySelectorAll('img[data-shot-picture]')].every((picture) => !picture.classList.contains('w-full')),
    ).toBe(true);
  });

  it('sizes each measured cell of a fitted part at its own width, so its picture is as tall as its cell', async () => {
    const states = ['mark', 'clear-space', 'misuse'];
    const logo = {
      ...SKETCH,
      targets: SKETCH.variants.map((variant) => ({ variant, states, interactions: [], unchanged: [] })),
    } satisfies ListedSketch;
    const { fixture, root } = await render(logo, noComments, { ...CARD, states });
    const sizes: Record<string, [number, number]> = { mark: [320, 320], 'clear-space': [265, 304], misuse: [342, 304] };

    for (const [state, [width, height]] of Object.entries(sizes)) {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: root.querySelector<HTMLIFrameElement>(`iframe[data-variant="a"][data-state="${state}"]`)!
            .contentWindow,
          data: { type: 'design-explore:height', height, width, viewport: { width: 342, height } },
        }),
      );
      await settle(fixture);
    }

    const row = fixture.componentInstance['rows']().find(({ key }) => key === 'a')!;

    expect(row.shots.map((shot) => [shot.state, shot.width ?? row.width, shot.height])).toEqual([
      ['mark', 320, 320],
      ['clear-space', 265, 304],
      ['misuse', 342, 304],
    ]);
  });

  it('holds a first open hidden until every shown state reported a size (tomflix shell-app at 1440 px)', async () => {
    const states = ['desktop', 'phone'];
    const variants = ['a', 'b', 'c'];
    const shellApp = {
      target: 'elements/shell-app',
      status: 'ready',
      createdAt: '2026-11-24T10:00:00Z',
      product: 'web',
      layer: 'elements',
      name: 'shell-app',
      dir: 'shell-app',
      variants,
      problems: [],
      targets: variants.map((variant) => ({ variant, states, interactions: [], unchanged: [] })),
    } satisfies ListedSketch;
    const { fixture, root } = await render(shellApp, noComments, {
      ...CARD,
      layer: 'elements',
      name: 'shell-app',
      states,
    });
    const report = async (state: string, width: number, height: number) => {
      for (const variant of ['current', ...variants])
        window.dispatchEvent(
          new MessageEvent('message', {
            source: root.querySelector<HTMLIFrameElement>(`iframe[data-variant="${variant}"][data-state="${state}"]`)!
              .contentWindow,
            data: { type: 'design-explore:height', height, width, viewport: { width, height } },
          }),
        );
      await settle(fixture);
    };
    const held = () => root.querySelector('[data-sk-sizing]') !== null;

    expect(held()).toBe(true);

    await report('desktop', 1472, 672);

    expect(held()).toBe(true);

    await report('phone', 422, 876);

    expect(held()).toBe(false);
  });

  it('keeps the live frames while a zoom gesture runs and updates them once it rests', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(100);
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(50);

    const states = ['default', 'hover', 'focus', 'active', 'disabled'];
    const wide = {
      ...SKETCH,
      targets: SKETCH.variants.map((variant) => ({ variant, states, interactions: [], unchanged: [] })),
    } satisfies ListedSketch;
    const { fixture, root } = await render(wide, noComments, { ...CARD, states });
    const live = () =>
      [...root.querySelectorAll<HTMLIFrameElement>('iframe[data-state]')].map((frame) => frame.src).sort();
    const before = live();

    root
      .querySelector('[data-sk-rows]')!
      .dispatchEvent(new WheelEvent('wheel', { ctrlKey: true, deltaY: -100, bubbles: true, cancelable: true }));
    root
      .querySelectorAll('iframe[data-state]')
      .forEach((frame) => frame.parentElement!.querySelector('img')!.dispatchEvent(new Event('load')));
    await settle(fixture);

    expect(before.length).toBe(12);
    expect(live()).toEqual(before);

    await new Promise((resolve) => setTimeout(resolve, 600));
    await settle(fixture);

    expect(live()).not.toEqual(before);
  });

  it('shows a live frame over its picture only once its page painted', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => window.setTimeout(callback, 0));
    const { fixture, root } = await render(ROUNDED, noComments);
    const iframe = root.querySelector<HTMLIFrameElement>('iframe[data-state]')!;
    const picture = () => iframe.parentElement!.querySelector('img[data-shot-picture]')!;

    expect(iframe.classList).toContain('opacity-0');
    expect(iframe.hasAttribute('data-painted')).toBe(false);
    expect(picture().classList).not.toContain('opacity-0');

    window.dispatchEvent(
      new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'design-explore:painted' } }),
    );
    await settle(fixture);

    expect(iframe.classList).not.toContain('opacity-0');
    expect(iframe.hasAttribute('data-painted')).toBe(true);
    expect(picture().classList).toContain('opacity-0');
  });

  it('draws every variant of a page sketch once per preset at its width, as tall as its content and at least its preset', async () => {
    const page: ListedSketch = {
      ...ROUNDED,
      target: 'pages/overview',
      layer: 'pages',
      name: 'overview',
      dir: 'pages-overview',
      rounds: [{ key: 'r1', title: 'First', note: '' }],
      variantInfo: { a: { round: 'r1' }, b: { round: 'r1' } },
      targets: ['a', 'b'].map((variant) => ({ variant, states: ['default'], interactions: [], unchanged: [] })),
    };
    const { fixture, root } = await render(page, noComments, null, {
      ...PRODUCT,
      presets: { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } },
    });

    const report = async (variant: string, height: number, width: number) => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: root.querySelector<HTMLIFrameElement>(`iframe[data-variant="${variant}"]`)!.contentWindow,
          data: { type: 'design-explore:height', height, width, viewport: { width: 390, height: 844 } },
        }),
      );
      await settle(fixture);
    };

    await report('a', 1550, 310);
    await report('b', 0, 740);

    const rows = fixture.componentInstance['rows']();

    expect(rows.map((row) => row.width)).toEqual([390, 390]);
    expect(rows.flatMap((row) => row.shots.map((shot) => [shot.state, shot.height, shot.width]))).toEqual([
      ['default · phone', 1550, undefined],
      ['default · desktop', 900, 1440],
      ['default · phone', 844, undefined],
      ['default · desktop', 900, 1440],
    ]);
    expect(root.querySelectorAll('iframe[data-variant="a"]').length).toBe(2);

    fixture.componentInstance['startComment']({ variant: 'a', shot: 'default · desktop', point: null });

    expect(fixture.componentInstance.commentStore.draft()?.place).toMatchObject({ state: 'default', size: 'desktop' });
    expect(fixture.componentInstance['sketchDraft']()?.shot).toBe('default · desktop');
  });

  // A comment on a part without widths is fitted, never the measured frame width the server rejects.
  it('starts a comment on a part without widths as fitted, and on a part with widths at its width', async () => {
    const { fixture, root } = await render(ROUNDED, noComments);

    window.dispatchEvent(
      new MessageEvent('message', {
        source: root.querySelector<HTMLIFrameElement>('iframe[data-variant="b"]')!.contentWindow,
        data: { type: 'design-explore:height', height: 300, width: 992, viewport: { width: 992, height: 800 } },
      }),
    );
    await settle(fixture);
    fixture.componentInstance['startComment']({ variant: 'b', shot: 'default', point: null });

    expect(fixture.componentInstance.commentStore.draft()?.place).toMatchObject({ state: 'default', size: 'fitted' });

    const sized = await render(ROUNDED, noComments, { ...CARD, widths: [390] });

    sized.fixture.componentInstance['startComment']({ variant: 'b', shot: 'default', point: null });

    expect(sized.fixture.componentInstance.commentStore.draft()?.place).toMatchObject({ state: 'default', size: 390 });
  });

  it('shows the picture, not a painted frame, while the frame page is narrower than its cell or scrolled', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => window.setTimeout(callback, 0));
    const { fixture, root } = await render(ROUNDED, noComments);
    const iframe = root.querySelector<HTMLIFrameElement>('iframe[data-state]')!;
    const picture = () => iframe.parentElement!.querySelector('img[data-shot-picture]')!;
    const post = async (data: object) => {
      window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data }));
      await settle(fixture);
    };

    await post({ type: 'design-explore:height', height: 96, viewport: { width: 70, height: 600 } });
    await post({ type: 'design-explore:painted' });

    expect(iframe.classList).toContain('opacity-0');
    expect(picture().classList).not.toContain('opacity-0');

    await post({ type: 'design-explore:height', height: 96, viewport: { width: 0, height: 600 } });
    await post({ type: 'design-explore:scroll', y: 40 });

    expect(iframe.classList).toContain('opacity-0');

    await post({ type: 'design-explore:scroll', y: 0, x: 250 });

    expect(iframe.classList).toContain('opacity-0');

    await post({ type: 'design-explore:scroll', y: 0, x: 0 });

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
      shots: shots.map(([state, changed]) => ({ state, changed, src: '', picture: '', place: { state } })),
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

  it('takes the cells that meet the viewport, even when a clipping ancestor hides their pixels, by distance from its centre', () => {
    const box = (left: number, top: number) => ({ left, top, right: left + 100, bottom: top + 100 });
    const near = nearShotsOf({
      cells: [
        { key: 'in', rect: box(450, 450) },
        { key: 'edge', rect: box(950, 0) },
        { key: 'beside', rect: box(1000, 0) },
        { key: 'far', rect: box(0, 5000) },
      ],
      viewport: { left: 0, top: 0, right: 1000, bottom: 1000 },
    });

    expect([...near.keys()]).toEqual(['in', 'edge']);
    expect(near.get('in')).toBe(0);
    expect(near.get('edge')).toBeGreaterThan(0);
  });

  it('keeps the live count at the cap when the viewport meets more cells', () => {
    const order = Array.from({ length: 40 }, (_, index) => `v s${index}`);
    const near = new Map(order.map((key, index) => [key, index] as const));

    expect(liveShotsOf({ order, near, cap: 20 })).toEqual(order.slice(0, 20));
  });

  it('fills the cap with whole states nearest to the view, listing order breaking ties', () => {
    const live = (distances: [string, number][]) =>
      liveShotsOf({ order: ['a 1', 'a 2', 'b 1', 'b 2'], near: new Map(distances), cap: 2 });

    expect(
      live([
        ['a 1', 900],
        ['a 2', 700],
        ['b 1', 100],
        ['b 2', 300],
      ]),
    ).toEqual(['a 1', 'b 1']);
    expect(
      live([
        ['a 1', 0],
        ['a 2', 0],
        ['b 1', 0],
      ]),
    ).toEqual(['a 1', 'b 1']);
  });

  it('never splits the cells of one state between live frames and pictures at the cap', () => {
    const order = ['current 1', 'current 2', 'a 1', 'a 2', 'b 1', 'b 2'];

    expect(liveShotsOf({ order, near: new Map(order.map((key) => [key, 0] as const)), cap: 4 })).toEqual([
      'current 1',
      'a 1',
      'b 1',
    ]);
    expect(liveShotsOf({ order, near: new Map([['b 2', 0]]), cap: 2 })).toEqual(['current 2', 'a 2', 'b 2']);
  });

  it('keeps the frames of a state with a painted cell ahead of a state whose cells all hold a picture', () => {
    expect(
      liveShotsOf({
        order: ['a 1', 'a 2', 'b 1', 'b 2'],
        near: new Map(['a 1', 'a 2', 'b 1', 'b 2'].map((key) => [key, 0] as const)),
        cap: 2,
        pictured: new Set(['a 1', 'b 1']),
        painted: new Set(['b 2']),
      }),
    ).toEqual(['a 2', 'b 2']);
  });

  it('keeps the state of a painted cell without a picture live after it leaves the near cells, until its picture loads', () => {
    const live = (pictured: string[]) =>
      liveShotsOf({
        order: ['a 1', 'a 2', 'b 1', 'b 2'],
        near: new Map([['b 2', 0]]),
        cap: 2,
        pictured: new Set(pictured),
        painted: new Set(['a 1']),
      });

    expect(live([])).toEqual(['a 1', 'a 2', 'b 1', 'b 2']);
    expect(live(['a 1'])).toEqual(['a 2', 'b 2']);
  });

  it('counts a painted frame only while it is as wide as its cell and its page is scrolled to the top', () => {
    expect(frameFitsCell({ cellWidth: 320, frameWidth: 320, viewportWidth: 320, scrollY: 0 })).toBe(true);
    expect(frameFitsCell({ cellWidth: 320, frameWidth: 320 })).toBe(true);
    expect(frameFitsCell({ cellWidth: 320, frameWidth: 320, viewportWidth: 70 })).toBe(false);
    expect(frameFitsCell({ cellWidth: 320, frameWidth: 240 })).toBe(false);
    expect(frameFitsCell({ cellWidth: 320, frameWidth: 320, scrollY: 40 })).toBe(false);
    expect(frameFitsCell({ cellWidth: 320, frameWidth: 320, scrollX: 250 })).toBe(false);
    expect(frameFitsCell({ cellWidth: 320, frameWidth: 320, scrollX: 0 })).toBe(true);
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

  // Decision: a pick in Studio is a merge, so Übernehmen calls the host once and no pick waits for a merge.
  it('asks to confirm Übernehmen and merges the variant only once confirmed', async () => {
    const bodies: Record<string, unknown> = {};
    const { fixture, root } = await render(SKETCH, (url, init) => {
      const path = ['sketch-decision', 'sketch-merge'].find((entry) => url.includes(`/__design/${entry}`));

      if (!path) return noComments(url);

      bodies[path] = JSON.parse(String(init?.body ?? '{}'));

      return json({ merged: ['components/card'] });
    });
    const completed: string[] = [];

    fixture.componentInstance.mergeComplete.subscribe((target) => completed.push(target));

    expect(mergeButtons(root)).toHaveLength(2);

    mergeButtons(root)[1]?.click();
    await settle(fixture);

    const dialog = [...document.querySelectorAll('[role="alertdialog"]')].at(-1);

    expect(dialog?.textContent).toContain(SKETCHES_LABELS.mergeConfirm.question('Variante b', 'components/card'));
    expect(root.querySelector('ethlete-sketches')).not.toBeNull();

    dialog?.querySelector<HTMLElement>('[data-sk-confirm-cancel]')?.click();
    await settle(fixture);

    expect(bodies).toEqual({});

    await confirmed(mergeButtons(root)[0], fixture);
    await settle(fixture);

    expect(bodies).toEqual({ 'sketch-decision': { kind: 'pick', variant: 'a' } });
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
      if (url.includes('/__design/sketch-decision'))
        return Promise.resolve(new Response(JSON.stringify(refusal.body), { status: refusal.status }));

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

    expect(errorText()).toBe(MERGE_LABELS.needsRebase(['components/card']));

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

  it('shows no status or refusal for a not-ready sketch, offers no merge and does not wait for a pick', async () => {
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

    expect(root.querySelector('[data-sk-toolbar] et-badge')).toBeNull();
    expect(root.querySelector('[data-sk-toolbar]')?.textContent).not.toContain('SHOT-NOT-VIEWED');
    expect(buttonNamed(root, SKETCHES_LABELS.merge)).toBeUndefined();
  });

  it('shows the auto-merge badge in the head only while the forecast says merges, also on a held merge', async () => {
    const badge = (root: HTMLElement) =>
      root.querySelector('[data-sk-toolbar] [data-sk-auto-merge]')?.textContent?.trim() ?? null;
    const forecast = (merges: boolean) => ({ merges, at: '2026-10-27T10:00:00Z' });
    const held = { reason: 'uncommitted edits', at: '2026-10-27T10:00:00Z', dirty: ['components/card.ts'] };
    const drawing = { ...SKETCH, status: 'in progress' as const, decision: undefined };

    expect(
      badge((await render({ ...drawing, autoMergeForecast: forecast(true), mergeHold: held }, noComments)).root),
    ).toBe(SKETCHES_LABELS.autoMerge);
    expect(badge((await render({ ...drawing, autoMergeForecast: forecast(false) }, noComments)).root)).toBeNull();
    expect(badge((await render({ ...drawing, autoMergeForecast: null }, noComments)).root)).toBeNull();
  });

  // The human decided Studio does not show why a merge is held or which files hold it.
  it('shows no merge-hold line on a held sketch', async () => {
    const held = { reason: 'uncommitted edits', at: '2026-10-27T10:00:00Z', dirty: ['shared/held-file.ts'] };
    const { root } = await render({ ...SKETCH, decision: undefined, mergeHold: held }, noComments);

    expect(root.querySelector('[data-sk-merge-hold]')).toBeNull();
    expect(root.textContent).not.toContain('shared/held-file.ts');
    expect(root.textContent).not.toContain('Automatischer Merge wartet');
    expect(root.textContent).not.toContain('Nicht automatisch gemerged');
  });

  it('offers no merge on a ready, picked sketch whose files changed after ready', async () => {
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

    expect(root.querySelector('[data-sk-toolbar] et-badge')).toBeNull();
    expect(buttonNamed(root, SKETCHES_LABELS.merge)).toBeUndefined();
  });

  it('derives the head badge from the drawing report and readiness, never from the sketch status alone', async () => {
    const badgeOf = (root: HTMLElement) => root.querySelector('[data-sk-toolbar] et-badge')?.textContent?.trim();
    const fresh = new Date(Date.now() - 5 * 60_000).toISOString();
    const stale = new Date(Date.now() - 40 * 60_000).toISOString();
    const open = { ...SKETCH, status: 'in progress' as const, decision: undefined };
    const status = SKETCHES_LABELS.status;

    const drawing = await render(
      { ...open, report: { message: 'zeichnet', updatedAt: fresh, variant: 'b', author: 'claude-opus-5-5' } },
      noComments,
    );

    expect(badgeOf(drawing.root)).toBe(status.drawing);
    expect(buttonNamed(drawing.root, SKETCHES_LABELS.merge)?.disabled).toBe(true);
    drawing.fixture.destroy();

    const stalled = await render(
      { ...open, report: { message: 'zeichnet', updatedAt: stale, variant: 'b', author: 'claude-opus-5-5' } },
      noComments,
    );

    expect(badgeOf(stalled.root)).toBeUndefined();
    expect(stalled.root.querySelector('[data-sk-toolbar]')?.textContent).not.toContain('Letzte Änderung');
    stalled.fixture.destroy();

    const silent = await render(
      {
        ...open,
        report: null,
        variantInfo: { a: { authors: ['claude-sonnet-5-5'] }, b: { authors: ['claude-opus-5-5'] } },
      },
      noComments,
    );

    expect(badgeOf(silent.root)).toBeUndefined();
    expect(buttonNamed(silent.root, SKETCHES_LABELS.merge)).toBeUndefined();
    silent.fixture.destroy();

    const ready = await render({ ...SKETCH, decision: undefined }, noComments);

    expect(badgeOf(ready.root)).toBe(status.waiting);
    expect(buttonNamed(ready.root, SKETCHES_LABELS.merge)).toBeDefined();
  });

  // The human decided Studio does not show the agent's task or step in the agent line.
  it('shows the agent line from the drawing report: the model, zeichnet and since when', async () => {
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

    expect(parts).toEqual(['', 'Sonnet 5.5', SKETCHES_LABELS.drawingMark, `· ${SKETCHES_LABELS.since(7)}`]);
    expect(root.querySelector('[data-sk-agent] svg[ethlete-agent-logo]')).not.toBeNull();
    expect(root.querySelector('[data-sk-agent]')?.textContent).not.toContain('baut Runde 3');
    expect(root.querySelector('[data-sk-agent]')?.textContent).not.toContain('Variante b');
  });

  // B695: the agent's report text is not something the human acts on, so no drawing row repeats it.
  it('draws every in-progress variant live with the drawing mark and no report text, never as a placeholder', async () => {
    const updatedAt = new Date(Date.now() - 2 * 60_000).toISOString();
    const { fixture, root } = await render(
      {
        ...SKETCH,
        status: 'in progress',
        decision: undefined,
        variants: ['a', 'b', 'c'],
        rounds: [
          { key: 'r1', title: '', note: '' },
          { key: 'r2', title: '', note: '' },
        ],
        report: { message: 'baut Runde 3', updatedAt, variant: 'b', author: 'claude-sonnet-5-5' },
        variantInfo: {
          a: { authors: ['claude-sonnet-5-5'], round: 'r1' },
          b: { authors: ['claude-sonnet-5-5'], round: 'r2' },
          c: { round: 'r2' },
        },
      },
      noComments,
    );
    root.querySelector<HTMLButtonElement>('[data-sk-folded] button')?.click();
    await settle(fixture);
    const row = (variant: string) => root.querySelector(`[data-sk-row="${variant}"]`);
    const textOf = (variant: string) => row(variant)?.textContent ?? '';

    expect(root.querySelector('[data-sk-placeholder-row]')).toBeNull();
    expect(root.querySelector('[data-sk-drawing-line]')).toBeNull();
    expect(row('b')?.querySelector('[data-shot]')).not.toBeNull();
    expect(row('c')?.querySelector('[data-shot]')).not.toBeNull();
    expect(textOf('b')).toContain(SKETCHES_LABELS.drawingMark);
    expect(textOf('c')).toContain(SKETCHES_LABELS.drawingMark);
    expect(textOf('a')).not.toContain(SKETCHES_LABELS.drawingMark);
    expect(textOf('b') + textOf('c')).not.toContain('baut Runde 3');
    expect(row('c')?.querySelector('[data-sk-merge]')).toBeNull();
  });

  it('shows the agent line while the report is fresh, and none once the report stalls', async () => {
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

    expect(drawing.root.querySelector('[data-sk-agent]')?.textContent).toContain(SKETCHES_LABELS.drawingMark);
    expect(drawing.root.querySelector('[data-sk-agent]')?.textContent).not.toContain('Zustand reset-hover');
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
    const labels = SKETCHES_LABELS.agentRun;

    expect(line).toContain('Opus 5.5');
    expect(line).not.toContain('tsc failed');
    expect(line).toContain(labels.ago(50));
    expect(line).toMatch(/Runde (\d+ )?fehlgeschlagen/);
    expect(root.querySelector('[data-sk-toolbar] et-badge')?.textContent?.trim()).toBe(SKETCHES_LABELS.status.failed);
    expect(root.querySelector('[data-sk-toolbar] [data-sk-failed]')?.textContent?.trim()).toBe('a: tsc failed (+1)');
    expect(buttonNamed(root, SKETCHES_LABELS.merge)).toBeUndefined();
  });

  it('waits for a pick only once every live frame drew, and names the error of a frame that failed', async () => {
    const { fixture, root } = await render({ ...ROUNDED, decision: undefined, report: null }, noComments);
    const frames = [...root.querySelectorAll<HTMLIFrameElement>('iframe[data-state]')];
    const failing = frames.at(-1)!;
    const status = SKETCHES_LABELS.status;
    const badge = () => root.querySelector('[data-sk-toolbar] et-badge')?.textContent?.trim();
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
    expect(buttonNamed(root, SKETCHES_LABELS.merge)?.disabled).toBe(true);

    for (const frame of frames.slice(0, -1)) await report(frame);
    await report(failing, { errored: true, error: 'design-explore: state "default" failed\nboom is not defined' });

    const variant = failing.dataset['variant'];

    expect(badge()).toBe(status.failed);
    expect(root.querySelector('[data-sk-toolbar] [data-sk-failed]')?.textContent?.trim()).toBe(
      `${variant} · default: boom is not defined`,
    );
    expect(root.querySelector('[data-sk-agent]')?.textContent).not.toContain('boom is not defined');
    expect(buttonNamed(root, SKETCHES_LABELS.merge)).toBeUndefined();

    await report(failing);

    expect(badge()).toBe(status.waiting);
    expect(buttonNamed(root, SKETCHES_LABELS.merge)?.disabled).toBe(false);
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
      SKETCHES_LABELS.mergePort(['elements/hero', 'elements/card']),
      `· ${SKETCHES_LABELS.since(4)}`,
    ]);
  });

  it('shows no port line without a port mark, even while the base is stale', async () => {
    const { root } = await render(
      { ...SKETCH, decision: undefined, report: null, staleBase: ['elements/hero'] },
      noComments,
    );

    expect(root.querySelector('[data-sk-merge-port]')).toBeNull();
  });

  // Decision: a pick in Studio is a merge, so a recorded pick shows no picked state.
  it('shows a ready sketch with a recorded pick as waiting, and the sketch points in the head of the variant whose merge was refused', async () => {
    const asked: string[] = [];
    const sketch: ListedSketch = {
      ...SKETCH,
      target: 'elements/rating',
      variants: ['a', 'b', 'c'],
      decision: { kind: 'pick', variant: 'c', decidedAt: '2026-10-27T10:00:00Z' },
      problems: [{ variant: 'c', problems: [{ file: 'c.ts', rule: 'UTILITY-CSS', message: 'flex' }] }],
    };
    const fetch = (url: string) => {
      if (url.includes('/__design/sketch-decision'))
        return Promise.resolve(new Response(JSON.stringify({ error: 'UTILITY-CSS c.ts: flex' }), { status: 422 }));
      if (!url.includes('/__design/open-points')) return noComments(url);
      asked.push(new URL(url).searchParams.get('part') ?? '');

      return json({
        points: [
          { kind: 'sketch-problem', sketch: 'elements/rating', variant: 'c', rule: 'UTILITY-CSS', message: 'flex' },
          { kind: 'unmerged-sketch', sketch: 'elements/rating', primary: true, status: 'ready', decision: null },
          { kind: 'missing-motion', from: 'rest', to: 'hover' },
        ],
        buildReady: { ready: false, blockers: [{ kind: 'pending', text: 'pending' }] },
      });
    };

    const { fixture, root } = await render(sketch, fetch, null as unknown as ListedPart);
    const badges = () =>
      [...root.querySelectorAll('[data-sk-toolbar] et-badge')].map((badge) => badge.textContent?.trim());

    expect(badges()).toEqual([SKETCHES_LABELS.status.waiting]);
    expect(root.querySelector('[data-sk-row][data-selected]')).toBeNull();
    expect(asked).toEqual([]);

    fixture.componentInstance['merge']('c');
    await settle(fixture);

    const chip = root.querySelector('[data-sk-row="c"][data-selected] [data-sk-points] [data-open-points-chip]');

    expect(badges()).toEqual([SKETCHES_LABELS.status.waiting]);
    expect(asked).toEqual(['elements/rating']);
    // B695: the agent fixes a sketch rule problem, so the chip counts only the unmerged sketch.
    expect(chip?.textContent?.trim()).toBe(SYSTEM_LABELS.openCount(1));
    expect(root.querySelectorAll('[data-sk-points]')).toHaveLength(1);
    expect(root.querySelector('[data-sk-merge-error]')?.textContent?.trim()).toBe('UTILITY-CSS c.ts: flex');
  });

  // The human decided Studio does not show the agent's model in the hold reason.
  it('shows a held sketch as paused with what it waits on and since when, without the model', async () => {
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

    expect(root.querySelector('[data-sk-toolbar] et-badge')?.textContent?.trim()).toBe(SKETCHES_LABELS.status.paused);
    expect(buttonNamed(root, SKETCHES_LABELS.merge)).toBeUndefined();

    root.querySelector<HTMLButtonElement>('[data-sk-hold]')?.click();
    await new Promise((done) => setTimeout(done));

    const reason = root.querySelector('[data-sk-hold-reason]')?.textContent ?? '';

    expect(reason).toContain(SKETCHES_LABELS.holdUntil('B99 und B100'));
    expect(reason).not.toContain('Sonnet 5.5');
    expect(reason).toContain(SKETCHES_LABELS.since(7));
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

  it('keeps the Verwerfen confirm open when a new listing names the same sketch', async () => {
    const { fixture, root } = await render(SKETCH, noComments);

    buttonNamed(root, 'Verwerfen')?.click();
    await settle(fixture);
    fixture.componentRef.setInput('sketch', { ...SKETCH });
    await settle(fixture);

    expect(document.querySelectorAll('[role="alertdialog"] [data-sk-confirm-cancel]')).toHaveLength(1);
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

  it('pins a resolved thread of this sketch on its variant, as resolved', async () => {
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
    const { root } = await render(SKETCH, (url) =>
      url.includes('/__design/comments') ? json({ comments: [comment], unreadable: [] }) : noComments(url),
    );

    expect(root.querySelector('[data-sk-row="b"] ethlete-comment-pin button')?.getAttribute('aria-label')).toBe(
      'Comment by Du, resolved',
    );
  });
});
