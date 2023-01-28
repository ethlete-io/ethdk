import { Directive, inject, InjectionToken, OnInit } from '@angular/core';
import { DestroyService } from '@ethlete/core';
import { combineLatest, takeUntil, tap } from 'rxjs';
import { InputDirective, INPUT_TOKEN } from '../../../../directives';

export const TEXT_INPUT_TOKEN = new InjectionToken<TextInputDirective>('ET_TEXT_INPUT_DIRECTIVE_TOKEN');

@Directive({
  standalone: true,
  exportAs: 'etTextInput',
  providers: [{ provide: TEXT_INPUT_TOKEN, useExisting: TextInputDirective }, DestroyService],
})
export class TextInputDirective implements OnInit {
  private readonly _destroy$ = inject(DestroyService).destroy$;
  readonly input = inject<InputDirective<string | null>>(INPUT_TOKEN);

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
}
