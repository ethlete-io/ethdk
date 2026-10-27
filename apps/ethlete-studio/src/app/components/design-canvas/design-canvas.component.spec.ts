import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { rememberView, rememberedView } from '../../studio-view/remembered';
import { CanvasFrame } from './canvas-frame';
import { DesignCanvasComponent } from './design-canvas.component';
import { CanvasFrameComponent } from './partials/canvas-frame.component';

const FITTED: CanvasFrame = { id: 'default', src: 'about:blank', label: 'default', error: 'not drawn in jsdom' };

const render = async (frames: CanvasFrame[]) => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

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

  it('remembers the measured size apart from a user resize, and places the frame by it after a reload', async () => {
    const fixture = await render([FITTED]);
    const frame = frameElement(fixture).componentInstance as CanvasFrameComponent;

    vi.useFakeTimers();

    frame.widthChange.emit(150);
    frame.heightChange.emit(70);
    vi.advanceTimersByTime(500);

    expect(rememberedView().measuredSizes).toEqual({ 'acme components/button default': { width: 150, height: 70 } });
    expect(rememberedView().frameSizes).toBeUndefined();

    fixture.destroy();
    TestBed.resetTestingModule();
    vi.useRealTimers();

    const reloaded = frameElement(await render([FITTED])).nativeElement as HTMLElement;

    expect(reloaded.classList).not.toContain('et-canvas-frame--unsized');
    expect(reloaded.style.width).toBe('150px');
    expect(reloaded.style.height).toBe('70px');
  });

  it('lets a hand-dragged size win over a measured one', async () => {
    rememberView({
      frameSizes: { 'acme components/button default': { width: 400 } },
      measuredSizes: { 'acme components/button default': { width: 150, height: 70 } },
    });

    const frame = frameElement(await render([FITTED])).nativeElement as HTMLElement;

    expect(frame.style.width).toBe('400px');
    expect(frame.style.height).toBe('70px');
  });
});
