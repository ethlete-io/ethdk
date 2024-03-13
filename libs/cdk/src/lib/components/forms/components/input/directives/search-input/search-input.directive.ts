import { Directive, inject, InjectionToken, OnInit } from '@angular/core';
import { createDestroy } from '@ethlete/core';
import { combineLatest, takeUntil, tap } from 'rxjs';
import { INPUT_TOKEN, InputDirective } from '../../../../directives/input';

export const SEARCH_INPUT_TOKEN = new InjectionToken<SearchInputDirective>('ET_SEARCH_INPUT_DIRECTIVE_TOKEN');

@Directive({
  standalone: true,
  exportAs: 'etSearchInput',
  providers: [{ provide: SEARCH_INPUT_TOKEN, useExisting: SearchInputDirective }],
})
export class SearchInputDirective implements OnInit {
  private readonly _destroy$ = createDestroy();
  readonly input = inject<InputDirective<string | null>>(INPUT_TOKEN);

  ngOnInit(): void {
    combineLatest([this.input.value$, this.input.nativeInputElement$])
      .pipe(
        tap(([value, inputEl]) => {
          if (!inputEl) return;

          if (value !== inputEl.value) {
            inputEl.value = value ?? '';
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

    if (value === '') {
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

  _clear(event?: Event) {
    if (this.input.value === null) return;

    event?.preventDefault();
    event?.stopPropagation();

    this.input._updateValue(null);
    this._controlTouched();
  }
}
