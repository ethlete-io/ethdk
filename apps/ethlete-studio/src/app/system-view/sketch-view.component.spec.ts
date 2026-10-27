import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListedPart, ListedProduct, ListedSketch } from '../../host/design';
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
