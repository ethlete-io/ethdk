import { Directive, InjectionToken, Input, TemplateRef, booleanAttribute, input } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { NativeSelectOptionValue } from '../../types';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const NATIVE_SELECT_OPTION_TOKEN = new InjectionToken<NativeSelectOptionDirective>(
  'ET_NATIVE_SELECT_OPTION_DIRECTIVE_TOKEN',
);

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
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
