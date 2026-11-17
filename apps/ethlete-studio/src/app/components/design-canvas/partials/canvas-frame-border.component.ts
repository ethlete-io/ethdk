import { Component, ViewEncapsulation } from '@angular/core';

/** The 1 px edge of a canvas frame; inside a `group/frame` a primary outline marks it selected, dashed while active. */
@Component({
  selector: 'ethlete-canvas-frame-border',
  template: '',
  encapsulation: ViewEncapsulation.None,
  host: {
    class:
      'pointer-events-none absolute shadow-[0_0_0_calc(0.1rem*var(--et-design-canvas-label-scale))_var(--et-surface-border-solid)] outline-0 outline-solid group-data-active/frame:outline-dashed group-data-selected/frame:outline-[calc(0.2rem*var(--et-design-canvas-label-scale))] group-data-selected/frame:outline-(--et-theme-color-primary-solid)',
    'data-frame-border': '',
  },
})
export class CanvasFrameBorderComponent {}
