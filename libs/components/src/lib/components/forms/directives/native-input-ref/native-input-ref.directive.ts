import { Directive, ElementRef, inject, InjectionToken } from '@angular/core';

export const NATIVE_INPUT_REF_TOKEN = new InjectionToken<NativeInputRefDirective>(
  'ET_NATIVE_INPUT_REF_DIRECTIVE_TOKEN',
);

@Directive({
  selector: 'input[etNativeInputRef], textarea[etNativeInputRef], select[etNativeInputRef], button[etNativeInputRef]',
  standalone: true,
  providers: [{ provide: NATIVE_INPUT_REF_TOKEN, useExisting: NativeInputRefDirective }],
})
export class NativeInputRefDirective {
  readonly element = inject<ElementRef<HTMLInputElement>>(ElementRef);
}
