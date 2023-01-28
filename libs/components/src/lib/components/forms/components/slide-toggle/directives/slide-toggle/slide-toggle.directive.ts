import { Directive, inject, InjectionToken } from '@angular/core';
import { createReactiveBindings } from '@ethlete/core';
import { map } from 'rxjs';
import { InputDirective, INPUT_TOKEN } from '../../../../directives';

export const SLIDE_TOGGLE_TOKEN = new InjectionToken<SlideToggleDirective>('ET_SLIDE_TOGGLE_DIRECTIVE_TOKEN');

@Directive({
  standalone: true,
  providers: [{ provide: SLIDE_TOGGLE_TOKEN, useExisting: SlideToggleDirective }],
  exportAs: 'etSlideToggle',
})
export class SlideToggleDirective {
  readonly input = inject<InputDirective<boolean>>(INPUT_TOKEN);
  readonly checked$ = this.input.value$.pipe(map((value) => !!value));

  readonly _bindings = createReactiveBindings(
    {
      attribute: ['class.et-slide-toggle--checked'],
      observable: this.checked$,
    },
    {
      attribute: ['class.et-slide-toggle--disabled'],
      observable: this.input.disabled$,
    },
  );

  _onInputInteraction(event: Event) {
    event.stopPropagation();

    this.input._updateValue(!this.input.value);

    this._controlTouched();
  }

  _controlTouched() {
    this.input._markAsTouched();
  }
}
