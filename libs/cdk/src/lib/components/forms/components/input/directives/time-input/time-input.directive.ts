import { Directive, inject, InjectionToken, OnInit } from '@angular/core';
import { createDestroy } from '@ethlete/core';
import { format, parse } from 'date-fns';
import { combineLatest, takeUntil, tap } from 'rxjs';
import { INPUT_TOKEN, InputDirective } from '../../../../directives/input';

export const TIME_INPUT_TOKEN = new InjectionToken<TimeInputDirective>('ET_TIME_INPUT_DIRECTIVE_TOKEN');
export const TIME_INPUT_FORMAT_TOKEN = new InjectionToken<string>('ET_TIME_INPUT_FORMAT_TOKEN');
export const DEFAULT_TIME_INPUT_FORMAT = 'HH:mm';

export const provideTimeFormat = (timeFormat: string) => ({
  provide: TIME_INPUT_FORMAT_TOKEN,
  useValue: timeFormat,
});

const TIME_INPUT_FORMAT = 'HH:mm';

@Directive({
  exportAs: 'etTimeInput',
  providers: [{ provide: TIME_INPUT_TOKEN, useExisting: TimeInputDirective }],
})
export class TimeInputDirective implements OnInit {
  private readonly _destroy$ = createDestroy();
  private readonly _timeFormat = inject(TIME_INPUT_FORMAT_TOKEN, { optional: true }) || DEFAULT_TIME_INPUT_FORMAT;
  readonly input = inject<InputDirective<string | null>>(INPUT_TOKEN);

  ngOnInit(): void {
    combineLatest([this.input.value$, this.input.nativeInputElement$])
      .pipe(
        tap(([value, inputEl]) => {
          if (!inputEl) return;

          const formattedTime = value ? format(parse(value, this._timeFormat, new Date()), TIME_INPUT_FORMAT) : '';

          if (formattedTime !== inputEl.value) {
            inputEl.value = formattedTime;
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
      const formattedTime = format(parse(value, this._timeFormat, new Date()), this._timeFormat);

      this.input._updateValue(formattedTime);
    }

    this.input._markAsTouched();
  }

  _controlTouched() {
    this.input._markAsTouched();
    this.input._setShouldDisplayError(true);
  }
}
