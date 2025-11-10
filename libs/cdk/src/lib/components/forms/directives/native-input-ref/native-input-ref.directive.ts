import { Directive, ElementRef, inject, InjectionToken } from '@angular/core';

export const NATIVE_INPUT_REF_TOKEN = new InjectionToken<NativeInputRefDirective>(
  'ET_NATIVE_INPUT_REF_DIRECTIVE_TOKEN',
);

@Directive({
  selector: 'input[etNativeInputRef], textarea[etNativeInputRef], select[etNativeInputRef], button[etNativeInputRef]',

  providers: [{ provide: NATIVE_INPUT_REF_TOKEN, useExisting: NativeInputRefDirective }],
})
export class NativeInputRefDirective<T extends HTMLElement = HTMLElement> {
  readonly element = inject<ElementRef<T>>(ElementRef);
}
