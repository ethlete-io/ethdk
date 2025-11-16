import { Directive, InjectionToken, Input, TemplateRef, booleanAttribute, input } from '@angular/core';
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

  // TODO: Skipped for migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @Input()
  get value() {
    return this._value$.getValue();
  }
  set value(value: NativeSelectOptionValue) {
    this._value$.next(value);
  }
  private _value$ = new BehaviorSubject<NativeSelectOptionValue>(null);

  readonly disabled = input(false, { transform: booleanAttribute });

  readonly hidden = input(false, { transform: booleanAttribute });

  readonly key = input<string>();

  _setTextTemplate(template: TemplateRef<unknown> | null): void {
    this._textTemplate$.next(template);
  }
}
