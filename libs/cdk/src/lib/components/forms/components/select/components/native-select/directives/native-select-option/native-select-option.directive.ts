import { Directive, InjectionToken, Input, TemplateRef, booleanAttribute } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { NativeSelectOptionValue } from '../../types';

export const NATIVE_SELECT_OPTION_TOKEN = new InjectionToken<NativeSelectOptionDirective>(
  'ET_NATIVE_SELECT_OPTION_DIRECTIVE_TOKEN',
);

@Directive({
  exportAs: 'etNativeSelectOption',
  providers: [{ provide: NATIVE_SELECT_OPTION_TOKEN, useExisting: NativeSelectOptionDirective }],
})
export class NativeSelectOptionDirective {
  private readonly _textTemplate$ = new BehaviorSubject<TemplateRef<unknown> | null>(null);

  get textTemplate$() {
    return this._textTemplate$.asObservable();
  }

  @Input()
  get value() {
    return this._value$.getValue();
  }
  set value(value: NativeSelectOptionValue) {
    this._value$.next(value);
  }
  private _value$ = new BehaviorSubject<NativeSelectOptionValue>(null);

  @Input({ transform: booleanAttribute })
  disabled = false;

  @Input({ transform: booleanAttribute })
  hidden = false;

  @Input()
  key?: string;

  _setTextTemplate(template: TemplateRef<unknown> | null): void {
    this._textTemplate$.next(template);
  }
}
