import { Directive, ElementRef, inject, InjectionToken } from '@angular/core';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const NATIVE_INPUT_REF_TOKEN = new InjectionToken<NativeInputRefDirective>(
  'ET_NATIVE_INPUT_REF_DIRECTIVE_TOKEN',
);

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  selector: 'input[etNativeInputRef], textarea[etNativeInputRef], select[etNativeInputRef], button[etNativeInputRef]',

  providers: [{ provide: NATIVE_INPUT_REF_TOKEN, useExisting: NativeInputRefDirective }],
})
export class NativeInputRefDirective<T extends HTMLElement = HTMLElement> {
  readonly element = inject<ElementRef<T>>(ElementRef);
}
