import { Directive, inject, InjectionToken, OnInit } from '@angular/core';
import { DestroyService } from '@ethlete/core';
import { combineLatest, takeUntil, tap } from 'rxjs';
import { InputDirective, INPUT_TOKEN } from '../../../../directives';

export const NUMBER_INPUT_TOKEN = new InjectionToken<NumberInputDirective>('ET_NUMBER_INPUT_DIRECTIVE_TOKEN');

@Directive({
  standalone: true,
  exportAs: 'etNumberInput',
  providers: [{ provide: NUMBER_INPUT_TOKEN, useExisting: NumberInputDirective }, DestroyService],
})
export class NumberInputDirective implements OnInit {
  private readonly _destroy$ = inject(DestroyService, { self: true }).destroy$;
  readonly input = inject<InputDirective<number | null>>(INPUT_TOKEN);

  ngOnInit(): void {
    combineLatest([this.input.value$, this.input.nativeInputRef$])
      .pipe(
        tap(([value, nativeInputRef]) => {
          if (!nativeInputRef) return;

          const val = value !== null ? `${value}` : '';

          if (val !== nativeInputRef.element.nativeElement.value) {
            nativeInputRef.element.nativeElement.value = val;
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
