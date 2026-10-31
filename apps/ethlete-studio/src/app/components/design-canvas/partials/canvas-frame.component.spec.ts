import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { vi } from 'vitest';
import { THEMES } from '../../../../themes';
import { CanvasFrameComponent } from './canvas-frame.component';

describe('CanvasFrameComponent swap between shot and page', () => {
  let decoded: () => void;
  let fixture: ComponentFixture<CanvasFrameComponent>;

  const flush = async () => {
    for (let tick = 0; tick < 4; tick++) await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
  };

  const post = (data: object) =>
    window.dispatchEvent(
      new MessageEvent('message', { source: fixture.nativeElement.querySelector('iframe').contentWindow, data }),
    );

  const shown = () => {
    const host = fixture.nativeElement as HTMLElement;
    const image = host.querySelector('img');
    const iframe = host.querySelector('iframe');

    return {
      shot: !!image && !image.classList.contains('opacity-0'),
      page: !!iframe && !iframe.classList.contains('opacity-0'),
      mounted: !!iframe,
    };
  };

  beforeEach(async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => window.setTimeout(callback, 0));
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      configurable: true,
      value: () => new Promise<void>((resolve) => (decoded = resolve)),
    });
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
    });
    fixture = TestBed.createComponent(CanvasFrameComponent);
    fixture.componentRef.setInput('frame', {
      id: 'default',
      src: 'about:blank',
      label: 'default',
      width: 300,
      height: 200,
      screenshot: 'default.png',
    });
    fixture.componentRef.setInput('width', 300);
    fixture.componentRef.setInput('live', true);
    await flush();
  });

  afterEach(() => {
    delete (HTMLImageElement.prototype as Partial<HTMLImageElement>).decode;
    vi.restoreAllMocks();
  });

  it('keeps the shot until the page says it painted, then shows the page in one step', async () => {
    post({ type: 'design-explore:loading' });
    post({ type: 'design-explore:height', height: 200 });
    await flush();

    expect(shown()).toEqual({ shot: true, page: false, mounted: true });

    post({ type: 'design-explore:painted' });
    await flush();

    expect(shown()).toEqual({ shot: false, page: true, mounted: true });
  });

  it('keeps the page after it leaves live until the shot decoded, then shows the shot in one step', async () => {
    post({ type: 'design-explore:painted' });
    await flush();
    fixture.componentRef.setInput('live', false);
    await flush();

    expect(shown()).toEqual({ shot: false, page: true, mounted: true });

    decoded();
    await flush();

    expect(shown()).toEqual({ shot: true, page: false, mounted: false });
  });
});

describe('CanvasFrameComponent shot states', () => {
  let fixture: ComponentFixture<CanvasFrameComponent>;

  const flush = (ms: number) => vi.advanceTimersByTimeAsync(ms);

  const host = () => fixture.nativeElement as HTMLElement;

  const copy = (scheme: string) => host().querySelector(`[data-scheme-copy="${scheme}"]`) as HTMLElement;

  const shotOf = (scheme: string) => copy(scheme).querySelector('img') as HTMLImageElement;

  beforeEach(async () => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
    });
    fixture = TestBed.createComponent(CanvasFrameComponent);
    fixture.componentRef.setInput('frame', {
      id: 'default',
      src: 'about:blank',
      label: 'default',
      width: 300,
      height: 200,
      screenshot: 'http://localhost/__design/shot?call=a',
      schemes: ['light', 'dark'],
    });
    fixture.componentRef.setInput('width', 300);
    fixture.componentRef.setInput('height', 200);
    await flush(20);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a failed shot as an error in its own scheme copy only', async () => {
    shotOf('dark').dispatchEvent(new Event('error'));
    shotOf('light').dispatchEvent(new Event('load'));
    await flush(20);

    expect(copy('dark').querySelector('[data-shot-failed]')?.textContent).toContain('Render failed');
    expect(copy('light').querySelector('[data-shot-failed]')).toBeNull();
  });

  it('marks a shot that takes long as rendering until it loads, per scheme copy', async () => {
    await flush(1000);

    expect(host().querySelector('[data-shot-slow]')).toBeNull();

    await flush(1500);

    expect(copy('light').querySelector('[data-shot-slow]')).not.toBeNull();
    expect(copy('dark').querySelector('[data-shot-slow]')).not.toBeNull();

    shotOf('light').dispatchEvent(new Event('load'));
    await flush(20);

    expect(copy('light').querySelector('[data-shot-slow]')).toBeNull();
    expect(copy('dark').querySelector('[data-shot-slow]')).not.toBeNull();
  });
});

describe('CanvasFrameComponent failed shot size', () => {
  it('gives a frame without a size room to show a failed shot', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
    });

    const fixture = TestBed.createComponent(CanvasFrameComponent);
    const sizes: number[] = [];

    fixture.componentRef.setInput('frame', {
      id: 'fitted',
      src: 'about:blank',
      label: 'fitted',
      screenshot: 'fitted.png',
    });
    fixture.componentRef.setInput('width', 0);
    fixture.componentInstance.widthChange.subscribe((width) => sizes.push(width));
    fixture.componentInstance.heightChange.subscribe((height) => sizes.push(height));
    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement).querySelector('img')?.dispatchEvent(new Event('error'));
    await fixture.whenStable();

    expect(sizes).toEqual([320, 160]);
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-shot-failed]')).not.toBeNull();
  });
});
