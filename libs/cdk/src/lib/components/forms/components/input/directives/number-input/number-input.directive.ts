import { Directive, inject, InjectionToken, OnInit } from '@angular/core';
import { createDestroy } from '@ethlete/core';
import { combineLatest, takeUntil, tap } from 'rxjs';
import { INPUT_TOKEN, InputDirective } from '../../../../directives/input';

export const NUMBER_INPUT_TOKEN = new InjectionToken<NumberInputDirective>('ET_NUMBER_INPUT_DIRECTIVE_TOKEN');

@Directive({
  exportAs: 'etNumberInput',
  providers: [{ provide: NUMBER_INPUT_TOKEN, useExisting: NumberInputDirective }],
})
export class NumberInputDirective implements OnInit {
  private readonly _destroy$ = createDestroy();
  readonly input = inject<InputDirective<number | null>>(INPUT_TOKEN);

  ngOnInit(): void {
    combineLatest([this.input.value$, this.input.nativeInputElement$])
      .pipe(
        tap(([value, inputEl]) => {
          if (!inputEl) return;

          const val = value !== null ? `${value}` : '';

          if (val !== inputEl.value) {
            inputEl.value = val;
          }
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();
  }

  _onInputInteraction(event: Event) {
    event.stopPropagation();

    const input = event.target as HTMLInputElement;
    const value = input.valueAsNumber;

    if (Number.isNaN(value)) {
      this.input._updateValue(null);
    } else {
      this.input._updateValue(value);
    }

    this.input._markAsTouched();
  }

  _controlTouched() {
    this.input._markAsTouched();
    this.input._setShouldDisplayError(true);
  }
}
