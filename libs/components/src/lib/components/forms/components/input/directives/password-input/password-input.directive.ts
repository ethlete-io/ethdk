import { Directive, inject, InjectionToken, OnInit } from '@angular/core';
import { DestroyService } from '@ethlete/core';
import { BehaviorSubject, combineLatest, takeUntil, tap } from 'rxjs';
import { InputDirective, INPUT_TOKEN } from '../../../../directives';

export const PASSWORD_INPUT_TOKEN = new InjectionToken<PasswordInputDirective>('ET_PASSWORD_INPUT_DIRECTIVE_TOKEN');

@Directive({
  standalone: true,
  exportAs: 'etPasswordInput',
  providers: [{ provide: PASSWORD_INPUT_TOKEN, useExisting: PasswordInputDirective }, DestroyService],
})
export class PasswordInputDirective implements OnInit {
  private readonly _destroy$ = inject(DestroyService, { self: true }).destroy$;
  readonly input = inject<InputDirective<string | null>>(INPUT_TOKEN);
  readonly showPassword$ = new BehaviorSubject(false);

  ngOnInit(): void {
    combineLatest([this.input.value$, this.input.nativeInputRef$])
      .pipe(
        tap(([value, nativeInputRef]) => {
          if (!nativeInputRef) return;

          if (value !== nativeInputRef.element.nativeElement.value) {
            nativeInputRef.element.nativeElement.value = value ?? '';
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

    this._controlTouched();
  }

  _controlTouched() {
    this.input._markAsTouched();
  }

  _toggleShowPassword() {
    this.showPassword$.next(!this.showPassword$.value);
  }
}
