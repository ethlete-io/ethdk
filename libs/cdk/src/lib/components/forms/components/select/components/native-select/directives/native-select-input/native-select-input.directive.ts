import { ContentChildren, Directive, inject, InjectionToken, OnInit, TrackByFunction } from '@angular/core';
import { createDestroy, TypedQueryList } from '@ethlete/core';
import { combineLatest, takeUntil, tap } from 'rxjs';
import { INPUT_TOKEN, InputDirective } from '../../../../../../directives/input';
import { NativeSelectOptionValue } from '../../types';
import { NATIVE_SELECT_OPTION_TOKEN, NativeSelectOptionDirective } from '../native-select-option';

export const NATIVE_SELECT_INPUT_TOKEN = new InjectionToken<NativeSelectInputDirective>(
  'ET_NATIVE_SELECT_INPUT_DIRECTIVE_TOKEN',
);

@Directive({
  standalone: true,
  exportAs: 'etNativeSelectInput',
  providers: [{ provide: NATIVE_SELECT_INPUT_TOKEN, useExisting: NativeSelectInputDirective }],
})
export class NativeSelectInputDirective implements OnInit {
  private readonly _destroy$ = createDestroy();
  readonly input = inject<InputDirective<NativeSelectOptionValue, HTMLSelectElement>>(INPUT_TOKEN);

  @ContentChildren(NATIVE_SELECT_OPTION_TOKEN, { descendants: true })
  readonly options?: TypedQueryList<NativeSelectOptionDirective>;

  ngOnInit(): void {
    combineLatest([this.input.value$, this.input.nativeInputRef$])
      .pipe(
        tap(([value, nativeInputRef]) => {
          if (!nativeInputRef) return;

          const val = value !== null ? `${value}` : 'null';

          if (val !== nativeInputRef.element.nativeElement.value) {
            nativeInputRef.element.nativeElement.value = val;
          }
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();
  }

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
}
