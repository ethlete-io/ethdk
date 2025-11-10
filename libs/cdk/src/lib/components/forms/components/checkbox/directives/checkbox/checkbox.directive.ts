import { Directive, inject, InjectionToken } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { signalHostClasses } from '@ethlete/core';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { INPUT_TOKEN, InputDirective } from '../../../../directives/input';

export const CHECKBOX_TOKEN = new InjectionToken<CheckboxDirective>('ET_CHECKBOX_DIRECTIVE_TOKEN');

@Directive({
  providers: [{ provide: CHECKBOX_TOKEN, useExisting: CheckboxDirective }],
  exportAs: 'etCheckbox',
})
export class CheckboxDirective {
  readonly input = inject<InputDirective<boolean>>(INPUT_TOKEN);
  readonly checked$ = this.input.value$.pipe(map((value) => !!value));
  readonly indeterminate$ = new BehaviorSubject(false);

  readonly hostClassBindings = signalHostClasses({
    'et-checkbox--checked': toSignal(this.checked$),
    'et-checkbox--disabled': toSignal(this.input.disabled$),
    'et-checkbox--indeterminate': toSignal(
      combineLatest([this.checked$, this.indeterminate$]).pipe(
        map(([checked, indeterminate]) => !checked && indeterminate),
      ),
    ),
  });

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
