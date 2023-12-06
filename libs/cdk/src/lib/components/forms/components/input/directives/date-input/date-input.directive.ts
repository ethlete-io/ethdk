import { formatDate } from '@angular/common';
import { Directive, inject, InjectionToken, LOCALE_ID, OnInit } from '@angular/core';
import { createDestroy } from '@ethlete/core';
import { combineLatest, takeUntil, tap } from 'rxjs';
import { INPUT_TOKEN, InputDirective } from '../../../../directives';

export const DATE_INPUT_TOKEN = new InjectionToken<DateInputDirective>('ET_DATE_INPUT_DIRECTIVE_TOKEN');
export const DATE_INPUT_FORMAT_TOKEN = new InjectionToken<string>('ET_DATE_INPUT_FORMAT_TOKEN');
export const DEFAULT_DATE_INPUT_FORMAT = "yyyy-MM-dd'T'HH:mm:ssZZZ";

export const provideDateFormat = (dateFormat: string) => ({
  provide: DATE_INPUT_FORMAT_TOKEN,
  useValue: dateFormat,
});

@Directive({
  standalone: true,
  exportAs: 'etDateInput',
  providers: [{ provide: DATE_INPUT_TOKEN, useExisting: DateInputDirective }],
})
export class DateInputDirective implements OnInit {
  private readonly _destroy$ = createDestroy();
  private readonly _localeId = inject(LOCALE_ID);
  private readonly _dateFormat = inject(DATE_INPUT_FORMAT_TOKEN, { optional: true }) || DEFAULT_DATE_INPUT_FORMAT;
  readonly input = inject<InputDirective<string | null>>(INPUT_TOKEN);

  ngOnInit(): void {
    combineLatest([this.input.value$, this.input.nativeInputElement$])
      .pipe(
        tap(([value, inputEl]) => {
          if (!inputEl) return;

          const formattedDate = value ? formatDate(value, 'yyyy-MM-dd', this._localeId) : '';

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
    const value = input.valueAsDate;

    if (!value) {
      this.input._updateValue(null);
    } else {
      const formattedDate = formatDate(value, this._dateFormat, this._localeId);

      this.input._updateValue(formattedDate);
    }

    this.input._markAsTouched();
  }

  _controlTouched() {
    this.input._markAsTouched();
    this.input._setShouldDisplayError(true);
  }
}
