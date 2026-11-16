import { Component, ElementRef, inject, ViewEncapsulation } from '@angular/core';
import { FocusRingDirective } from '@ethlete/components';
import { trackPointerFocus } from '../../components/design-canvas/pointer-focus';
import { STUDIO_LABELS } from '../../i18n/studio-labels';

@Component({
  selector: 'ethlete-canvas-viewport',
  template: `<ng-content />`,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [FocusRingDirective],
  host: {
    class:
      'block cursor-grab touch-none transition-[outline-color] duration-(--duration-state) ease-(--ease-standard) [--et-focus-ring-offset:-2px] data-pointer-focus:outline-transparent active:cursor-grabbing',
    tabindex: '0',
    'aria-label': STUDIO_LABELS.canvas.label,
  },
})
export class CanvasViewportComponent {
  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef);

    trackPointerFocus(host.nativeElement);
  }
}
