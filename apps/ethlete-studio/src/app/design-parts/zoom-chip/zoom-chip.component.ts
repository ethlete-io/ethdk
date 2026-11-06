import { Component, input, output, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { AutoSurfaceDirective } from '@ethlete/core';

@Component({
  selector: 'ethlete-zoom-chip',
  template: `
    <span class="contents" data-camera-out>
      <button
        (click)="zoomOut.emit()"
        et-button
        type="button"
        variant="transparent"
        color="surface"
        size="sm"
        aria-label="Verkleinern"
      >
        −
      </button>
    </span>
    <span class="contents" data-camera-reset>
      <button
        (click)="zoomReset.emit()"
        et-button
        type="button"
        variant="transparent"
        color="surface"
        size="sm"
        title="Zoom to 100 % (Shift+0)"
        aria-label="Auf 100 % zoomen"
      >
        {{ percent() }} %
      </button>
    </span>
    <span class="contents" data-camera-in>
      <button
        (click)="zoomIn.emit()"
        et-button
        type="button"
        variant="transparent"
        color="surface"
        size="sm"
        aria-label="Vergrößern"
      >
        +
      </button>
    </span>
    <span class="contents" data-camera-fit>
      <button
        (click)="fit.emit()"
        et-button
        type="button"
        variant="transparent"
        color="surface"
        size="sm"
        title="Zoom to fit (Shift+1)"
        aria-label="Einpassen"
      >
        Fit
      </button>
    </span>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
  hostDirectives: [AutoSurfaceDirective],
  host: {
    class:
      'inline-flex rounded-control-md border font-ui border-(--et-overlay-surface-border-color,var(--et-surface-border-solid)) bg-et-surface-bg shadow-(--et-anchored-panel-shadow,0_10px_24px_rgb(var(--et-shadow-color-rgb,0_0_0)/0.16))',
    'data-canvas-zoom': '',
  },
})
export class ZoomChipComponent {
  public percent = input(100);

  public zoomOut = output();
  public zoomReset = output();
  public zoomIn = output();
  public fit = output();
}
