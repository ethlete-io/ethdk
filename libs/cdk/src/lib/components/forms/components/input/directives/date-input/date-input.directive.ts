import { Directive, inject, InjectionToken, OnInit } from '@angular/core';
import { createDestroy } from '@ethlete/core';
import { format } from 'date-fns';
import { combineLatest, takeUntil, tap } from 'rxjs';
import { INPUT_TOKEN, InputDirective } from '../../../../directives/input';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const DATE_INPUT_TOKEN = new InjectionToken<DateInputDirective>('ET_DATE_INPUT_DIRECTIVE_TOKEN');
/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const DATE_INPUT_FORMAT_TOKEN = new InjectionToken<string>('ET_DATE_INPUT_FORMAT_TOKEN');
/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const DEFAULT_DATE_INPUT_FORMAT = "yyyy-MM-dd'T'HH:mm:ssxxx";

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const provideDateFormat = (dateFormat: string) => ({
  provide: DATE_INPUT_FORMAT_TOKEN,
  useValue: dateFormat,
});

const DATE_INPUT_FORMAT = 'yyyy-MM-dd';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  exportAs: 'etDateInput',
  providers: [{ provide: DATE_INPUT_TOKEN, useExisting: DateInputDirective }],
})
export class DateInputDirective implements OnInit {
  private readonly _destroy$ = createDestroy();
  private readonly _dateFormat = inject(DATE_INPUT_FORMAT_TOKEN, { optional: true }) || DEFAULT_DATE_INPUT_FORMAT;
  readonly input = inject<InputDirective<string | null>>(INPUT_TOKEN);

  ngOnInit(): void {
    combineLatest([this.input.value$, this.input.nativeInputElement$])
      .pipe(
        tap(([value, inputEl]) => {
          if (!inputEl) return;

          const formattedDate = value ? format(value, DATE_INPUT_FORMAT) : '';

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
