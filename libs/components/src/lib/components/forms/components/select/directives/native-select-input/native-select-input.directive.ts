import { ContentChildren, Directive, inject, InjectionToken, TrackByFunction } from '@angular/core';
import { createReactiveBindings, TypedQueryList } from '@ethlete/core';
import { BehaviorSubject } from 'rxjs';
import { NativeSelectOptionValue } from '../../..';
import { InputDirective, INPUT_TOKEN } from '../../../../directives';
import { NativeSelectOptionDirective, NATIVE_SELECT_OPTION_TOKEN } from '../native-select-option';

export const NATIVE_SELECT_INPUT_TOKEN = new InjectionToken<NativeSelectInputDirective>(
  'ET_NATIVE_SELECT_INPUT_DIRECTIVE_TOKEN',
);

@Directive({
  standalone: true,
  exportAs: 'etNativeSelectInput',
  providers: [{ provide: NATIVE_SELECT_INPUT_TOKEN, useExisting: NativeSelectInputDirective }],
})
export class NativeSelectInputDirective {
  readonly input = inject<InputDirective<NativeSelectOptionValue>>(INPUT_TOKEN);

  @ContentChildren(NATIVE_SELECT_OPTION_TOKEN, { descendants: true })
  readonly options?: TypedQueryList<NativeSelectOptionDirective>;

  readonly isOpen$ = new BehaviorSubject<boolean>(false);

  readonly _bindings = createReactiveBindings({
    attribute: 'class.et-native-select--open',
    observable: this.isOpen$,
  });

  _trackByFn: TrackByFunction<NativeSelectOptionDirective> = (index, option) => option.key ?? option.value;

  _onInputInteraction(event: Event) {
    event.stopPropagation();

    if (!this.options) {
      return;
    }

    const input = event.target as HTMLSelectElement;
    const selectedOption = this.options.toArray()[input.selectedIndex];

    if (!selectedOption) {
      return;
    }

    this.input._updateValue(selectedOption.value);
    this.input._markAsTouched();
    this.input._setShouldDisplayError(true);
  }

  _controlTouched() {
    this.input._markAsTouched();
    this.input._setShouldDisplayError(true);
  }

  _close() {
    this.isOpen$.next(false);
  }
}
