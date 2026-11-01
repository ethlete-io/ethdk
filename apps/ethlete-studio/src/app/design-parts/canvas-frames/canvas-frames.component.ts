import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { signalElementDimensions } from '@ethlete/core';
import { CanvasViewportComponent } from '../canvas-viewport/canvas-viewport.component';
import { ZoomChipComponent } from '../zoom-chip/zoom-chip.component';

/** The frames of one part on the canvas: projected frames from the top left at `zoom`, or the first frame fitted and centred with `fitted`, the zoom chip in the corner. */
@Component({
  selector: 'ethlete-canvas-frames',
  template: `
    <ethlete-canvas-viewport #viewport class="relative h-full min-h-120 overflow-hidden pl-(--st-shell-inset-left,0px)">
      <div
        #strip
        [style.zoom]="zoom()"
        [style.transform]="transform()"
        [style.transform-origin]="transform() ? '0 0' : null"
        class="flex flex-col items-start gap-30 px-10 py-12"
        data-canvas-frames
      >
        <ng-content />
      </div>
      <ethlete-zoom-chip
        [percent]="percent()"
        (zoomOut)="zoomOut.emit()"
        (zoomReset)="zoomReset.emit()"
        (zoomIn)="zoomIn.emit()"
        (fit)="fit.emit()"
        class="absolute right-space-3 bottom-space-3"
      />
    </ethlete-canvas-viewport>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CanvasViewportComponent, ZoomChipComponent],
  host: { class: 'block h-full' },
})
export class CanvasFramesComponent {
  public zoom = input('100%');
  public fitted = input(false);

  public zoomOut = output();
  public zoomReset = output();
  public zoomIn = output();
  public fit = output();

  private viewport = viewChild.required<CanvasViewportComponent, ElementRef<HTMLElement>>('viewport', {
    read: ElementRef,
  });
  private strip = viewChild.required<ElementRef<HTMLElement>>('strip');
  private viewportSize = signalElementDimensions(this.viewport);
  private stripSize = signalElementDimensions(this.strip);

  protected percent = computed(() => parseFloat(this.zoom()));
  protected transform = signal<string | null>(null);

  public constructor() {
    afterRenderEffect(() => {
      const fitted = this.fitted();

      this.viewportSize();
      this.stripSize();

      const canvas = this.viewport().nativeElement;
      const strip = this.strip().nativeElement;
      const frame = strip.firstElementChild;

      this.transform.set(fitted && frame instanceof HTMLElement ? fitTransform({ canvas, strip, frame }) : null);
    });
  }
}

const FIT_PADDING = 64;

const layoutOffsetOf = (element: HTMLElement) => {
  let x = 0;
  let y = 0;

  for (let node: Element | null = element; node instanceof HTMLElement; node = node.offsetParent) {
    x += node.offsetLeft;
    y += node.offsetTop;
  }

  return [x, y] as const;
};

export const fitTransform = ({
  canvas,
  strip,
  frame,
}: {
  canvas: HTMLElement;
  strip: HTMLElement;
  frame: HTMLElement;
}) => {
  const covered = parseFloat(getComputedStyle(canvas).paddingLeft) || 0;
  const width = canvas.clientWidth - covered;
  const height = canvas.clientHeight;
  const zoom = Math.min(
    1,
    (width - FIT_PADDING * 2) / frame.offsetWidth,
    (height - FIT_PADDING * 2) / frame.offsetHeight,
  );

  if (!Number.isFinite(zoom) || zoom <= 0) return null;

  const left = (width - frame.offsetWidth * zoom) / 2;
  const top = Math.min((height - frame.offsetHeight * zoom) / 2, FIT_PADDING);
  const [frameX, frameY] = layoutOffsetOf(frame);
  const [stripX, stripY] = layoutOffsetOf(strip);
  const frameLeft = frameX - stripX;
  const frameTop = frameY - stripY;

  return `translate(${left - frameLeft * zoom}px, ${top - frameTop * zoom}px) scale(${zoom})`;
};
