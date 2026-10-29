import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { ListedPart, ListedProduct, ListedSketch } from '../../host/design';
import { THEMES } from '../../themes';
import { DesignCanvasComponent } from '../components/design-canvas/design-canvas.component';
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

describe('SketchViewComponent merge preview', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('EventSource', SilentEventSource);
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideCommentStore()] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('shows a rendering dot while the compare runs', async () => {
    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });
      if (url.includes('/__design/sketch-preview'))
        return json({ changed: ['components/card'], affected: ['pages/home'] });

      return new Promise(() => undefined);
    });

    const fixture = TestBed.createComponent(SketchViewComponent);

    fixture.componentRef.setInput('port', 4402);
    fixture.componentRef.setInput('product', PRODUCT);
    fixture.componentRef.setInput('sketch', SKETCH);
    fixture.componentRef.setInput('part', null as ListedPart | null);
    fixture.componentRef.setInput('cameraKey', 'web sketch:components/card');
    localStorage.setItem(
      'ethlete-studio.call-view',
      JSON.stringify({ sketchViews: { 'web sketch:components/card': { merge: true } } }),
    );
    fixture.autoDetectChanges();
    await settle(fixture);

    const root: HTMLElement = fixture.nativeElement;
    const preview = root.querySelector('[data-merge-preview]');

    expect(preview?.textContent).toContain('Comparing 1 part now and after the merge');
    expect(preview?.querySelector('[data-merge-compare-rendering]')).not.toBeNull();
  });

  it('shows the pixel diff per state under each variant and marks a changed box on its frame on a click', async () => {
    const asked: string[] = [];

    vi.stubGlobal('fetch', (url: string) => {
      asked.push(url);
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });
      if (url.includes('/__design/sketch-diff'))
        return json({
          target: 'components/card',
          variant: new URL(url).searchParams.get('variant'),
          states: [
            { state: 'default', box: { x: 4, y: 2, width: 8, height: 4 } },
            { state: 'empty', box: null },
          ],
        });

      return new Promise(() => undefined);
    });

    const fixture = TestBed.createComponent(SketchViewComponent);

    fixture.componentRef.setInput('port', 4402);
    fixture.componentRef.setInput('product', PRODUCT);
    fixture.componentRef.setInput('sketch', {
      ...SKETCH,
      targets: ['a', 'b'].map((variant) => ({ variant, states: ['default', 'empty'], interactions: [] })),
    });
    fixture.componentRef.setInput('part', null as ListedPart | null);
    fixture.autoDetectChanges();
    await settle(fixture);

    const root: HTMLElement = fixture.nativeElement;
    const summaries = [...root.querySelectorAll<HTMLButtonElement>('[data-variant-diff-summary]')];

    expect(summaries.map((summary) => summary.textContent?.trim())).toEqual([
      '1 of 2 states differs in pixels',
      '1 of 2 states differs in pixels',
    ]);
    expect(root.querySelector('[data-variant-diff]')).toBeNull();

    summaries[0]?.click();
    await settle(fixture);

    const lines = [...root.querySelectorAll('[data-variant-diff]')].map((line) => line.textContent?.trim());

    expect(lines).toEqual(['default · 8 × 4 px']);
    expect(
      asked.some((url) => url.includes('/__design/sketch-diff?product=web&sketch=components%2Fcard&variant=b')),
    ).toBe(true);
    expect(root.querySelector('[data-part-outline]')).toBeNull();

    root.querySelector<HTMLButtonElement>('button[data-variant-diff]')?.click();
    await settle(fixture);

    const outline = root.querySelector<HTMLElement>('[data-part-outline]');

    expect(outline?.style.width).toBe('8px');
    expect(outline?.style.height).toBe('4px');
  });

  it('leaves an interaction for rest and zooms to the frame of a marked changed box', async () => {
    const zoomed = vi.spyOn(DesignCanvasComponent.prototype, 'zoomToFrame');

    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });
      if (url.includes('/__design/sketch-diff'))
        return json({
          target: 'components/card',
          variant: new URL(url).searchParams.get('variant'),
          states: [{ state: 'default', box: { x: 4, y: 2, width: 8, height: 4 } }],
        });

      return new Promise(() => undefined);
    });
    localStorage.setItem(
      'ethlete-studio.call-view',
      JSON.stringify({ sketchViews: { 'web sketch:components/card': { interaction: 'hover' } } }),
    );

    const fixture = TestBed.createComponent(SketchViewComponent);

    fixture.componentRef.setInput('port', 4402);
    fixture.componentRef.setInput('product', PRODUCT);
    fixture.componentRef.setInput('sketch', {
      ...SKETCH,
      targets: ['a', 'b'].map((variant) => ({ variant, states: ['default'], interactions: ['hover'] })),
    });
    fixture.componentRef.setInput('part', null as ListedPart | null);
    fixture.componentRef.setInput('cameraKey', 'web sketch:components/card');
    fixture.autoDetectChanges();
    await settle(fixture);

    expect(fixture.componentInstance.interaction()).toBe('hover');

    const root: HTMLElement = fixture.nativeElement;

    root.querySelector<HTMLButtonElement>('[data-variant-diff-summary]')?.click();
    await settle(fixture);
    root.querySelector<HTMLButtonElement>('button[data-variant-diff]')?.click();
    await settle(fixture);

    expect(fixture.componentInstance.interaction()).toBe('rest');
    expect(zoomed).toHaveBeenCalledWith('a default');
    zoomed.mockRestore();
  });

  it('flips a drawing column to drawn with a note once its report turns 30 minutes old', async () => {
    vi.stubGlobal('fetch', (url: string) =>
      url.includes('/__design/comments') ? json({ comments: [], unreadable: [] }) : new Promise(() => undefined),
    );

    const updatedAt = new Date(Date.now() - 30 * 60_000 + 2000).toISOString();
    const fixture = TestBed.createComponent(SketchViewComponent);

    fixture.componentRef.setInput('port', 4402);
    fixture.componentRef.setInput('product', PRODUCT);
    fixture.componentRef.setInput('sketch', {
      ...SKETCH,
      status: 'in progress',
      decision: undefined,
      report: { message: 'variant b', updatedAt, variant: 'b', author: null },
    });
    fixture.componentRef.setInput('part', null as ListedPart | null);
    fixture.componentRef.setInput('cameraKey', 'web sketch:components/card');
    fixture.autoDetectChanges();
    await settle(fixture);

    const columnB = () => fixture.componentInstance.canvas().columns.find((column) => column.key === 'b');

    expect(columnB()).toMatchObject({ label: 'b · drawing …', drawing: true });

    await new Promise((resolve) => setTimeout(resolve, 2100));
    await settle(fixture);

    expect(columnB()).toMatchObject({ label: 'b', drawing: false, note: 'No report for 30 min' });
  });

  it('opens and folds a state no variant changes on a click on its row head, and remembers it', async () => {
    vi.stubGlobal('fetch', (url: string) =>
      url.includes('/__design/comments') ? json({ comments: [], unreadable: [] }) : new Promise(() => undefined),
    );

    const fixture = TestBed.createComponent(SketchViewComponent);
    const card: ListedPart = {
      layer: 'components',
      name: 'card',
      origin: 'product',
      note: null,
      states: ['default', 'empty'],
      problems: [],
    };

    fixture.componentRef.setInput('port', 4402);
    fixture.componentRef.setInput('product', PRODUCT);
    fixture.componentRef.setInput('sketch', {
      ...SKETCH,
      targets: [
        { variant: 'a', states: ['default', 'empty'], unchanged: ['default'] },
        { variant: 'b', states: ['default', 'empty'], unchanged: ['default'] },
      ],
    });
    fixture.componentRef.setInput('part', card);
    fixture.componentRef.setInput('cameraKey', 'web sketch:components/card');
    fixture.autoDetectChanges();
    await settle(fixture);

    const rows = () => [...new Set(fixture.componentInstance.canvas().frames.map((frame) => frame.row))];
    const head = () =>
      [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button[aria-expanded]')].find(
        (button) => button.textContent?.includes('default · unchanged in a b'),
      );

    expect(rows()).toEqual(['empty']);
    expect(head()?.getAttribute('aria-expanded')).toBe('false');

    head()?.click();
    await settle(fixture);

    expect(rows()).toEqual(['empty', 'default']);
    expect(head()?.getAttribute('aria-expanded')).toBe('true');
    expect(JSON.parse(localStorage.getItem('ethlete-studio.call-view') ?? '{}').sketchViews).toEqual({
      'web sketch:components/card': { states: { default: true } },
    });

    head()?.click();
    await settle(fixture);

    expect(rows()).toEqual(['empty']);
  });

  it('ignores the round flags remembered for an earlier sketch of the same part', async () => {
    vi.stubGlobal('fetch', (url: string) =>
      url.includes('/__design/comments') ? json({ comments: [], unreadable: [] }) : new Promise(() => undefined),
    );
    localStorage.setItem(
      'ethlete-studio.call-view',
      JSON.stringify({
        sketchViews: {
          'web sketch:components/card': { rounds: { r1: false }, roundsFor: '2026-10-20T10:00:00Z' },
        },
      }),
    );

    const fixture = TestBed.createComponent(SketchViewComponent);

    fixture.componentRef.setInput('port', 4402);
    fixture.componentRef.setInput('product', PRODUCT);
    fixture.componentRef.setInput('sketch', { ...SKETCH, rounds: [{ key: 'r1', title: 'First', note: '' }] });
    fixture.componentRef.setInput('part', {
      layer: 'components',
      name: 'card',
      origin: 'product',
      note: null,
      states: ['default'],
      problems: [],
    } satisfies ListedPart);
    fixture.componentRef.setInput('cameraKey', 'web sketch:components/card');
    fixture.autoDetectChanges();
    await settle(fixture);

    expect(fixture.componentInstance['matrix']().columns.map((column) => column.key)).toContain('a');
  });
});

describe('SketchViewComponent merge without a note', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('EventSource', SilentEventSource);
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideCommentStore(), ...provideColorThemesWithTailwind4(THEMES)],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('merges the picked variant with an empty note field and sends no note', async () => {
    const bodies: Record<string, unknown> = {};

    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });

      const path = ['sketch-decision', 'sketch-merge'].find((entry) => url.includes(`/__design/${entry}`));

      if (path) {
        bodies[path] = JSON.parse(String(init?.body ?? '{}'));

        return json(path === 'sketch-merge' ? { merged: ['components/card'] } : {});
      }

      return new Promise(() => undefined);
    });

    const fixture = TestBed.createComponent(SketchViewComponent);
    const completed: string[] = [];

    fixture.componentRef.setInput('port', 4402);
    fixture.componentRef.setInput('product', PRODUCT);
    fixture.componentRef.setInput('sketch', SKETCH);
    fixture.componentInstance.mergeComplete.subscribe((target) => completed.push(target));
    fixture.autoDetectChanges();
    await settle(fixture);

    const root: HTMLElement = fixture.nativeElement;
    const button = root.querySelector<HTMLButtonElement>('[data-merge]');

    expect(button?.disabled).toBe(false);

    button?.click();
    await settle(fixture);

    expect(bodies).toEqual({ 'sketch-decision': { kind: 'pick', variant: 'b' }, 'sketch-merge': {} });
    expect(completed).toEqual(['components/card']);
  });

  it('lets the user merge and discard while the sketch has open comments', async () => {
    const comment = {
      part: 'components/card',
      state: 'empty',
      size: 360,
      interaction: 'rest',
      sketch: { target: 'components/card', variant: 'b' },
      id: 'c1',
      text: 'Tighter',
      createdAt: '2026-10-27T10:00:00Z',
      replies: [],
      threadState: 'agent',
      stale: null,
    };

    vi.stubGlobal('fetch', (url: string) =>
      url.includes('/__design/comments')
        ? json({ comments: [comment, { ...comment, id: 'c2', sketch: undefined }], unreadable: [] })
        : new Promise(() => undefined),
    );

    TestBed.runInInjectionContext(() => injectCommentStore()).connect(
      signal({ address: { port: 4402, product: 'web' }, revision: 0 }),
    );

    const fixture = TestBed.createComponent(SketchViewComponent);

    fixture.componentRef.setInput('port', 4402);
    fixture.componentRef.setInput('product', PRODUCT);
    fixture.componentRef.setInput('sketch', SKETCH);
    fixture.autoDetectChanges();
    await settle(fixture);

    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('[data-product-comments]')).not.toBeNull();
    expect(root.querySelector('[data-merge-lock]')).toBeNull();
    expect(root.querySelector<HTMLButtonElement>('[data-merge]')?.disabled).toBe(false);
    expect(root.querySelector<HTMLButtonElement>('[data-discard]')?.disabled).toBe(false);
  });
});

describe('SketchViewComponent on a refused merge', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('EventSource', SilentEventSource);
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideCommentStore(), ...provideColorThemesWithTailwind4(THEMES)],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('shows the reason, the changed parts and the rebase command with a copy button', async () => {
    const rebase = 'npx et design sketch rebase components/card --product web --by <model id>';
    const writeText = vi.fn(() => Promise.resolve());

    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/__design/comments')) return json({ comments: [], unreadable: [] });
      if (url.includes('/__design/sketch-decision')) return json({});
      if (url.includes('/__design/sketch-merge'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: 'components/card changed in the product since the sketch on components/card was created',
              changed: ['components/card', 'fixtures.ts'],
              rebase,
            }),
            { status: 422 },
          ),
        );

      return new Promise(() => undefined);
    });

    const fixture = TestBed.createComponent(SketchViewComponent);
    const merging: boolean[] = [];

    fixture.componentRef.setInput('port', 4402);
    fixture.componentRef.setInput('product', PRODUCT);
    fixture.componentRef.setInput('sketch', SKETCH);
    fixture.componentInstance.merging.subscribe((value) => merging.push(value));
    fixture.autoDetectChanges();
    fixture.componentInstance['note'].set('Calmer.');
    await settle(fixture);

    const root: HTMLElement = fixture.nativeElement;

    root.querySelector<HTMLButtonElement>('[data-merge]')?.click();
    await settle(fixture);

    const refusal = root.querySelector('[data-merge-refusal]');

    expect(merging).toEqual([true, false]);
    expect(refusal?.textContent).toContain('components/card changed in the product');
    expect(refusal?.querySelector('[data-merge-refusal-changed]')?.textContent?.trim()).toBe(
      'components/card, fixtures.ts',
    );
    expect(refusal?.querySelector('[data-rebase-command]')?.textContent).toBe(rebase);

    refusal?.querySelector<HTMLButtonElement>('[data-copy-rebase]')?.click();
    await settle(fixture);

    expect(writeText).toHaveBeenCalledWith(rebase);
    expect(refusal?.querySelector('[data-copy-rebase]')?.textContent?.trim()).toBe('Copied');
  });
});
