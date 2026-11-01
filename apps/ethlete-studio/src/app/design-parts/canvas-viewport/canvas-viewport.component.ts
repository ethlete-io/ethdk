import { Component, ViewEncapsulation } from '@angular/core';
import { FocusRingDirective } from '@ethlete/components';

@Component({
  selector: 'ethlete-canvas-viewport',
  template: `<ng-content />`,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [FocusRingDirective],
  host: {
    class:
      'block cursor-grab touch-none transition-[outline-color] duration-(--duration-state) ease-(--ease-standard) [--_et-focus-ring-offset:-2px] active:cursor-grabbing',
    tabindex: '0',
    'aria-label': 'Design Canvas',
  },
})
export class CanvasViewportComponent {}
