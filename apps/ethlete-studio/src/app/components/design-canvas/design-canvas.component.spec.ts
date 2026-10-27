import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { rememberedView } from '../../studio-view/remembered';
import { CanvasFrame } from './canvas-frame';
import { DesignCanvasComponent } from './design-canvas.component';
import { CanvasFrameComponent } from './partials/canvas-frame.component';

const FITTED: CanvasFrame = { id: 'default', src: 'about:blank', label: 'default', error: 'not drawn in jsdom' };

const render = async (frames: CanvasFrame[]) => {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture: ComponentFixture<DesignCanvasComponent> = TestBed.createComponent(DesignCanvasComponent);

  fixture.componentRef.setInput('frames', frames);
  fixture.componentRef.setInput('cameraKey', 'acme components/button');
  await fixture.whenStable();

  return fixture;
};

const frameElement = (fixture: ComponentFixture<DesignCanvasComponent>) =>
  fixture.debugElement.query(By.directive(CanvasFrameComponent));

describe('DesignCanvasComponent', () => {
  beforeEach(() => localStorage.clear());

  afterEach(() => vi.useRealTimers());

  it('hides a fitted frame until its size is known', async () => {
    const fixture = await render([FITTED]);
    const frame = frameElement(fixture);

    expect(frame.nativeElement.classList).toContain('et-canvas-frame--unsized');

    (frame.componentInstance as CanvasFrameComponent).widthChange.emit(150);
    (frame.componentInstance as CanvasFrameComponent).heightChange.emit(70);
    await fixture.whenStable();

    expect(frame.nativeElement.classList).not.toContain('et-canvas-frame--unsized');
    expect(frame.nativeElement.style.width).toBe('150px');
    expect(frame.nativeElement.style.height).toBe('70px');
  });

  it('remembers the measured size and places the frame by it after a reload', async () => {
    const fixture = await render([FITTED]);
    const frame = frameElement(fixture).componentInstance as CanvasFrameComponent;

    vi.useFakeTimers();

    frame.widthChange.emit(150);
    frame.heightChange.emit(70);
    vi.advanceTimersByTime(500);

    expect(rememberedView().measuredSizes).toEqual({ 'acme components/button default': { width: 150, height: 70 } });

    fixture.destroy();
    TestBed.resetTestingModule();
    vi.useRealTimers();

    const reloaded = frameElement(await render([FITTED])).nativeElement as HTMLElement;

    expect(reloaded.classList).not.toContain('et-canvas-frame--unsized');
    expect(reloaded.style.width).toBe('150px');
    expect(reloaded.style.height).toBe('70px');
  });

  it('reports a camera the user moved, and a fit as no camera to keep', async () => {
    const fixture = await render([FITTED]);
    const canvas = fixture.componentInstance;
    const reported: unknown[] = [];

    vi.useFakeTimers();
    canvas.cameraChange.subscribe((camera) => reported.push(camera));
    canvas.camera.set({ x: 5, y: -900, zoom: 0.2 });
    vi.advanceTimersByTime(400);
    expect(reported).toEqual([]);

    canvas['zoomBy'](2);
    vi.advanceTimersByTime(400);
    expect(reported).toEqual([{ x: 10, y: -1800, zoom: 0.4 }]);

    canvas.fitAll();
    vi.advanceTimersByTime(400);
    expect(reported.at(-1)).toBeNull();
  });

  it('sizes a fitted frame by its measured content, whatever size an older Studio stored for it', async () => {
    localStorage.setItem(
      'ethlete-studio.call-view',
      JSON.stringify({
        frameSizes: { 'acme components/button default': { width: 160, height: 80 } },
        measuredSizes: { 'acme components/button default': { width: 100, height: 68 } },
      }),
    );

    const fixture = await render([FITTED]);
    const frame = frameElement(fixture).nativeElement as HTMLElement;

    expect(frame.style.width).toBe('100px');
    expect(frame.style.height).toBe('68px');

    frameElement(fixture).triggerEventHandler('dblclick', new MouseEvent('dblclick'));
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('et-resize-handles')).toBeNull();
  });

  it('sets a state group of fitted matrix rows apart by twice the row gap', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
    });

    const fixture = TestBed.createComponent(DesignCanvasComponent);
    const cell = (row: string, group: string): CanvasFrame => ({
      ...FITTED,
      id: row,
      row,
      rowGroup: group,
      column: 'current',
    });

    fixture.componentRef.setInput('frames', [
      cell('solid · rest', 'solid'),
      cell('solid · hover', 'solid'),
      cell('outline · rest', 'outline'),
    ]);
    fixture.componentRef.setInput('arrangement', 'matrix');
    fixture.componentRef.setInput('columns', [{ key: 'current', label: 'current' }]);
    await fixture.whenStable();

    const [rest, hover, outline] = fixture.debugElement
      .queryAll(By.directive(CanvasFrameComponent))
      .map((frame) => frame.nativeElement as HTMLElement);
    const gapBelow = (above: HTMLElement | undefined, below: HTMLElement | undefined) =>
      parseFloat(below?.style.top ?? '') - parseFloat(above?.style.top ?? '') - parseFloat(above?.style.height ?? '');

    expect(gapBelow(rest, hover)).toBe(48);
    expect(gapBelow(hover, outline)).toBe(96);
  });

  it('draws no border on a fitted frame, but keeps it on a frame at a width', async () => {
    const fixture = await render([FITTED, { ...FITTED, id: 'wide', width: 320, height: 200 }]);
    const [fitted, wide] = fixture.debugElement
      .queryAll(By.directive(CanvasFrameComponent))
      .map((frame) => frame.nativeElement as HTMLElement);

    expect(fitted?.classList).toContain('et-canvas-frame--fitted');
    expect(wide?.classList).not.toContain('et-canvas-frame--fitted');
  });

  it('draws an outline over a frame at its offset in the frame', async () => {
    const fixture = await render([{ ...FITTED, id: 'wide', width: 320, height: 200 }]);

    fixture.componentRef.setInput('outlines', [
      { frameId: 'wide', x: 12, y: 34, width: 56, height: 78 },
      { frameId: 'gone', x: 0, y: 0, width: 1, height: 1 },
    ]);
    await fixture.whenStable();

    const frame = frameElement(fixture).nativeElement as HTMLElement;
    const outlines = [...fixture.nativeElement.querySelectorAll('[data-part-outline]')] as HTMLElement[];

    expect(outlines).toHaveLength(1);
    expect(parseFloat(outlines[0]?.style.left ?? '') - parseFloat(frame.style.left)).toBe(12);
    expect(parseFloat(outlines[0]?.style.top ?? '') - parseFloat(frame.style.top)).toBe(34);
    expect(outlines[0]?.style.width).toBe('56px');
    expect(outlines[0]?.style.height).toBe('78px');
  });

  it('makes a double-clicked frame live, marks it, and ends it on Esc from the frame or on comment mode', async () => {
    const frames = [
      { ...FITTED, width: 320, height: 200 },
      { ...FITTED, id: 'other', width: 320, height: 200 },
    ];
    const fixture = await render(frames);
    const [first, second] = fixture.debugElement.queryAll(By.directive(CanvasFrameComponent));
    const isLive = (frame = first) =>
      (frame?.nativeElement as HTMLElement).classList.contains('et-canvas-frame--active');

    first?.triggerEventHandler('dblclick', new MouseEvent('dblclick'));
    await fixture.whenStable();

    expect(isLive()).toBe(true);
    expect(first?.nativeElement.querySelector('[data-live-badge]')).not.toBeNull();

    second?.triggerEventHandler('dblclick', new MouseEvent('dblclick'));
    await fixture.whenStable();

    expect([isLive(first), isLive(second)]).toEqual([false, true]);

    (second?.componentInstance as CanvasFrameComponent).escapeKeydown.emit();
    await fixture.whenStable();

    expect(isLive(second)).toBe(false);

    first?.triggerEventHandler('dblclick', new MouseEvent('dblclick'));
    fixture.componentRef.setInput('pointing', true);
    await fixture.whenStable();

    expect(isLive()).toBe(false);
    expect(first?.nativeElement.querySelector('[data-live-badge]')).toBeNull();
  });
});
