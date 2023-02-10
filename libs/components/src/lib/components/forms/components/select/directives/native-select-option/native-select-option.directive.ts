import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { Directive, InjectionToken, Input, TemplateRef } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { NativeSelectOptionValue } from '../../types';

export const NATIVE_SELECT_OPTION_TOKEN = new InjectionToken<NativeSelectOptionDirective>(
  'ET_NATIVE_SELECT_OPTION_DIRECTIVE_TOKEN',
);

@Directive({
  standalone: true,
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

  @Input()
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(value: BooleanInput) {
    this._disabled = coerceBooleanProperty(value);
  }
  private _disabled = false;

  @Input()
  get hidden(): boolean {
    return this._hidden;
  }
  set hidden(value: BooleanInput) {
    this._hidden = coerceBooleanProperty(value);
  }
  private _hidden = false;

  @Input()
  key?: string;

  _setTextTemplate(template: TemplateRef<unknown> | null): void {
    this._textTemplate$.next(template);
  }
}
