import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { ListedPart, ListedProduct, ListedSketch } from '../../host/design';
import { THEMES } from '../../themes';
import { provideCommentStore } from './comment-store';
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

    expect(preview?.textContent).toContain('Comparing now and after the merge');
    expect(preview?.querySelector('[data-merge-compare-rendering]')).not.toBeNull();
  });

  it('flips a drawing column to drawn with a note once its report turns 30 minutes old', async () => {
    vi.stubGlobal('fetch', (url: string) =>
      url.includes('/__design/comments') ? json({ comments: [], unreadable: [] }) : new Promise(() => undefined),
    );

    const updatedAt = new Date(Date.now() - 30 * 60_000 + 300).toISOString();
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

    await new Promise((resolve) => setTimeout(resolve, 400));
    await settle(fixture);

    expect(columnB()).toMatchObject({ label: 'b', drawing: false, note: 'No report for 30 min' });
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
