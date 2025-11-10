import { Directive, inject, InjectionToken, OnInit } from '@angular/core';
import { createDestroy } from '@ethlete/core';
import { format } from 'date-fns';
import { combineLatest, takeUntil, tap } from 'rxjs';
import { INPUT_TOKEN, InputDirective } from '../../../../directives/input';

export const DATE_TIME_INPUT_TOKEN = new InjectionToken<DateTimeInputDirective>('ET_DATE_TIME_INPUT_DIRECTIVE_TOKEN');
export const DATE_TIME_INPUT_FORMAT_TOKEN = new InjectionToken<string>('ET_DATE_TIME_INPUT_FORMAT_TOKEN');
export const DEFAULT_DATE_TIME_INPUT_FORMAT = "yyyy-MM-dd'T'HH:mm:ssxxx";

export const provideDateTimeFormat = (dateFormat: string) => ({
  provide: DATE_TIME_INPUT_FORMAT_TOKEN,
  useValue: dateFormat,
});

const DATE_TIME_INPUT_FORMAT = "yyyy-MM-dd'T'HH:mm:ss.SSS";

@Directive({
  exportAs: 'etDateTimeInput',
  providers: [{ provide: DATE_TIME_INPUT_TOKEN, useExisting: DateTimeInputDirective }],
})
export class DateTimeInputDirective implements OnInit {
  private readonly _destroy$ = createDestroy();
  private readonly _dateFormat =
    inject(DATE_TIME_INPUT_FORMAT_TOKEN, { optional: true }) || DEFAULT_DATE_TIME_INPUT_FORMAT;
  readonly input = inject<InputDirective<string | null>>(INPUT_TOKEN);

  ngOnInit(): void {
    combineLatest([this.input.value$, this.input.nativeInputElement$])
      .pipe(
        tap(([value, inputEl]) => {
          if (!inputEl) return;

          const formattedDate = value ? format(value, DATE_TIME_INPUT_FORMAT) : '';

          if (formattedDate !== inputEl.value) {
            inputEl.value = formattedDate;
          }
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();
  }

  _onInputInteraction(event: Event) {
    event.stopPropagation();

    const input = event.target as HTMLInputElement;
    const value = input.value;

    if (!value) {
      this.input._updateValue(null);
    } else {
      const formattedDate = format(value, this._dateFormat);

      this.input._updateValue(formattedDate);
    }

    this.input._markAsTouched();
  }

  _controlTouched() {
    this.input._markAsTouched();
    this.input._setShouldDisplayError(true);
  }
}
