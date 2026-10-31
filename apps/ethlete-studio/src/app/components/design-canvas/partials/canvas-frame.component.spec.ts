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
