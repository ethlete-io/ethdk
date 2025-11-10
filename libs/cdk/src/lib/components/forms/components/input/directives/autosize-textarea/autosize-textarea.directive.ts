import { Directive, effect, inject, input, numberAttribute } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { signalElementDimensions } from '@ethlete/core';
import { INPUT_TOKEN, InputDirective } from '../../../../directives/input';

@Directive({
  selector: 'et-textarea-input[etAutosize]',
  host: {
    class: 'et-textarea--autosize',
  },
})
export class AutosizeTextareaDirective {
  private input = inject<InputDirective<string | null>>(INPUT_TOKEN, { host: true });

  maxHeight = input(null, { transform: numberAttribute, alias: 'etAutosizeMaxHeight' });

  constructor() {
    const el = toSignal(this.input.nativeInputElement$);
    const inputDimensions = signalElementDimensions(el);
    const val = toSignal(this.input.value$);

    effect(() => {
      const elem = el();
      const maxHeight = this.maxHeight();

      val();
      inputDimensions();

      if (elem) {
        this.updateSize(elem, maxHeight);
      }
    });
  }

  updateSize(el: HTMLElement, maxHeight: number | null) {
    el.style.height = '0';

    const newHeight = maxHeight ? Math.min(el.scrollHeight, maxHeight) : el.scrollHeight;

    el.style.height = `${newHeight}px`;
  }
}
