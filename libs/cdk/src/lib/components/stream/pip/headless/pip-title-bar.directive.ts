import { Directive, computed, inject } from '@angular/core';
import { DragHandleDirective, signalHostElementDimensions } from '@ethlete/core';

@Directive({
  selector: '[etPipTitleBar]',
  hostDirectives: [
    {
      directive: DragHandleDirective,
      inputs: ['disabled: dragDisabled'],
      outputs: ['dragTapped', 'dragStarted', 'dragMoved', 'dragEnded'],
    },
  ],
  host: {
    class: 'et-pip-window__title-bar',
  },
})
export class PipTitleBarDirective {
  private dims = signalHostElementDimensions();

  dragHandle = inject(DragHandleDirective);

  titleBarH = computed(() => this.dims().client?.height ?? 32);
}
