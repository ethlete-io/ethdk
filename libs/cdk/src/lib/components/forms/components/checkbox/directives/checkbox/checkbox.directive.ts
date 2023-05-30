import { Directive, inject, InjectionToken } from '@angular/core';
import { createReactiveBindings } from '@ethlete/core';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { INPUT_TOKEN, InputDirective } from '../../../../directives';

export const CHECKBOX_TOKEN = new InjectionToken<CheckboxDirective>('ET_CHECKBOX_DIRECTIVE_TOKEN');

@Directive({
  standalone: true,
  providers: [{ provide: CHECKBOX_TOKEN, useExisting: CheckboxDirective }],
  exportAs: 'etCheckbox',
})
export class CheckboxDirective {
  readonly input = inject<InputDirective<boolean>>(INPUT_TOKEN);
  readonly checked$ = this.input.value$.pipe(map((value) => !!value));
  readonly indeterminate$ = new BehaviorSubject(false);

  readonly _bindings = createReactiveBindings(
    {
      attribute: ['class.et-checkbox--checked'],
      observable: this.checked$,
    },
    {
      attribute: ['class.et-checkbox--disabled'],
      observable: this.input.disabled$,
    },
    {
      attribute: ['class.et-checkbox--indeterminate'],
      observable: combineLatest([this.checked$, this.indeterminate$]).pipe(
        map(([checked, indeterminate]) => !checked && indeterminate),
      ),
    },
  );

  _onInputInteraction(event: Event) {
    event.stopPropagation();

    this.input._updateValue(!this.input.value);
    this.input._markAsTouched();
    this.input._setShouldDisplayError(true);
  }

  _controlTouched() {
    this.input._markAsTouched();
    this.input._setShouldDisplayError(true);
  }
}
