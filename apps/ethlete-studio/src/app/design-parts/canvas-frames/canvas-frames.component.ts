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
import { canvasLabelScale, fitTransform } from './canvas-frames-geometry';

/** The frames of one part on the canvas: projected frames from the top left at `zoom`, or the first frame fitted and centred with `fitted`, the zoom chip in the corner. */
@Component({
  selector: 'ethlete-canvas-frames',
  template: `
    <ethlete-canvas-viewport #viewport class="relative h-full min-h-120 overflow-hidden pl-(--st-shell-inset-left,0px)">
      <div
        #strip
        [style.transform]="transform() ?? 'scale(' + scale() + ')'"
        [style.--st-canvas-label-scale]="labelScale()"
        class="flex origin-top-left flex-col items-start gap-30 px-10 py-12"
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
  protected scale = computed(() => this.percent() / 100);
  protected labelScale = computed(() => canvasLabelScale(this.scale()));
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
