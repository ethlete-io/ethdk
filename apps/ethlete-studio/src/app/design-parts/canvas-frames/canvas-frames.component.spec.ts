import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CanvasFramesComponent, fitTransform } from './canvas-frames.component';

@Component({
  template: `
    <ethlete-canvas-frames
      (zoomOut)="emitted.push('out')"
      (zoomReset)="emitted.push('reset')"
      (zoomIn)="emitted.push('in')"
      (fit)="emitted.push('fit')"
      zoom="25%"
    >
      <figure data-sample-frame>button</figure>
    </ethlete-canvas-frames>
  `,
  imports: [CanvasFramesComponent],
})
class HostComponent {
  public emitted: string[] = [];
}

const render = async () => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

  const fixture = TestBed.createComponent(HostComponent);

  await fixture.whenStable();

  return fixture;
};

describe('CanvasFramesComponent', () => {
  it('projects the frames into the zoomed column of the pannable canvas', async () => {
    const element = (await render()).nativeElement as HTMLElement;
    const column = element.querySelector<HTMLElement>('ethlete-canvas-viewport [data-canvas-frames]');

    expect(column?.querySelector('[data-sample-frame]')).not.toBeNull();
    expect(column?.style.zoom).toBe('25%');
  });

  it('shows the zoom in percent on the zoom chip', async () => {
    const element = (await render()).nativeElement as HTMLElement;

    expect(element.querySelector('ethlete-zoom-chip [aria-label="Auf 100 % zoomen"]')?.textContent?.trim()).toBe(
      '25 %',
    );
  });

  it('re-emits each zoom chip output', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;

    ['Verkleinern', 'Auf 100 % zoomen', 'Vergrößern', 'Einpassen'].forEach((label) =>
      element.querySelector<HTMLButtonElement>(`ethlete-zoom-chip [aria-label="${label}"]`)?.click(),
    );

    expect(fixture.componentInstance.emitted).toEqual(['out', 'reset', 'in', 'fit']);
  });
});

const box = (
  layout: Partial<Record<'offsetLeft' | 'offsetTop' | 'offsetWidth' | 'offsetHeight', number>>,
  offsetParent: HTMLElement | null,
) => {
  const element = document.createElement('div');

  Object.defineProperties(element, {
    offsetLeft: { value: layout.offsetLeft ?? 0 },
    offsetTop: { value: layout.offsetTop ?? 0 },
    offsetWidth: { value: layout.offsetWidth ?? 0 },
    offsetHeight: { value: layout.offsetHeight ?? 0 },
    offsetParent: { value: offsetParent },
  });

  return element;
};

describe('fitTransform', () => {
  const canvasOf = () => {
    const canvas = box({}, null);

    Object.defineProperties(canvas, { clientWidth: { value: 1376 }, clientHeight: { value: 900 } });
    canvas.style.paddingLeft = '260px';

    return canvas;
  };

  it('centres the frame in the canvas area right of the panel inset', () => {
    const canvas = canvasOf();
    const strip = box({ offsetLeft: 260 }, canvas);
    const frame = box({ offsetLeft: 300, offsetTop: 48, offsetWidth: 280, offsetHeight: 180 }, canvas);

    expect(fitTransform({ canvas, strip, frame })).toBe('translate(378px, 16px) scale(1)');
  });

  it('keeps the frame centred once the strip transform makes the strip its offset parent', () => {
    const canvas = canvasOf();
    const strip = box({ offsetLeft: 260 }, canvas);
    const frame = box({ offsetLeft: 40, offsetTop: 48, offsetWidth: 280, offsetHeight: 180 }, strip);

    expect(fitTransform({ canvas, strip, frame })).toBe('translate(378px, 16px) scale(1)');
  });
});
