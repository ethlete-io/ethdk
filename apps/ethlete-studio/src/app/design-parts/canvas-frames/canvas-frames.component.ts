import { Component, computed, input, output, ViewEncapsulation } from '@angular/core';
import { CanvasViewportComponent } from '../canvas-viewport/canvas-viewport.component';
import { ZoomChipComponent } from '../zoom-chip/zoom-chip.component';

/** The frames of one part on the canvas: projected frames from the top left at `zoom`, the zoom chip in the corner. */
@Component({
  selector: 'ethlete-canvas-frames',
  template: `
    <ethlete-canvas-viewport class="relative h-full min-h-120 overflow-hidden pl-(--st-shell-inset-left,0px)">
      <div [style.zoom]="zoom()" class="flex flex-col items-start gap-30 px-10 py-12" data-canvas-frames>
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

  public zoomOut = output();
  public zoomReset = output();
  public zoomIn = output();
  public fit = output();

  protected percent = computed(() => parseFloat(this.zoom()));
}
