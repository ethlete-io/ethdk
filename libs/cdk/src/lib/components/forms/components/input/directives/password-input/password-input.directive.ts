import { Directive, inject, InjectionToken, OnInit } from '@angular/core';
import { createDestroy } from '@ethlete/core';
import { BehaviorSubject, combineLatest, takeUntil, tap } from 'rxjs';
import { INPUT_TOKEN, InputDirective } from '../../../../directives/input';

export const PASSWORD_INPUT_TOKEN = new InjectionToken<PasswordInputDirective>('ET_PASSWORD_INPUT_DIRECTIVE_TOKEN');

@Directive({
  standalone: true,
  exportAs: 'etPasswordInput',
  providers: [{ provide: PASSWORD_INPUT_TOKEN, useExisting: PasswordInputDirective }],
})
export class PasswordInputDirective implements OnInit {
  private readonly _destroy$ = createDestroy();
  readonly input = inject<InputDirective<string | null>>(INPUT_TOKEN);
  readonly showPassword$ = new BehaviorSubject(false);

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

  _toggleShowPassword() {
    this.showPassword$.next(!this.showPassword$.value);
  }
}
