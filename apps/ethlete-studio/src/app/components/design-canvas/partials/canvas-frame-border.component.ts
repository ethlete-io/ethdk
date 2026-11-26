import { Component, ViewEncapsulation } from '@angular/core';

/** The 1 px edge of a canvas frame; inside a `group/frame` a dashed primary outline marks it live. */
@Component({
  selector: 'ethlete-canvas-frame-border',
  template: '',
  encapsulation: ViewEncapsulation.None,
  host: {
    class:
      'pointer-events-none absolute -z-1 shadow-[0_0_0_calc(0.1rem*var(--et-design-canvas-label-scale))_var(--et-surface-border)] outline-0 outline-dashed group-data-active/frame:outline-[calc(0.2rem*var(--et-design-canvas-label-scale))] group-data-active/frame:outline-(--et-tone-fill)',
    'data-frame-border': '',
  },
})
export class CanvasFrameBorderComponent {}
