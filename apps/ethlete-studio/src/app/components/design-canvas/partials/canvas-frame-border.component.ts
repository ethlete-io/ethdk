import { Component, ViewEncapsulation } from '@angular/core';

/** The outline of a canvas frame; inside a `group/frame` it turns dashed while active and primary while selected. */
@Component({
  selector: 'ethlete-canvas-frame-border',
  template: '',
  encapsulation: ViewEncapsulation.None,
  host: {
    class:
      'pointer-events-none absolute outline-[calc(0.1rem*var(--et-design-canvas-label-scale))] outline-(--et-surface-border-solid) outline-solid group-data-active/frame:outline-dashed group-data-selected/frame:outline-[calc(0.2rem*var(--et-design-canvas-label-scale))] group-data-selected/frame:outline-(--et-theme-color-primary-solid)',
    'data-frame-border': '',
  },
})
export class CanvasFrameBorderComponent {}
