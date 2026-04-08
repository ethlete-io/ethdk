import { Directive, input } from '@angular/core';
import { DragHandleDirective } from '@ethlete/core';

@Directive({
  selector: '[etPipCollapseOverlay]',
  host: {
    class: 'et-pip-window__collapse-overlay',
    '(pointerdown)': 'dragHandle().startGesture($event)',
  },
})
export class PipCollapseOverlayDirective {
  dragHandle = input.required<DragHandleDirective>();
}
