import { Directive, inject, ViewChild } from '@angular/core';
import { INPUT_TOKEN, NATIVE_INPUT_REF_TOKEN, NativeInputRefDirective } from '../directives';

@Directive()
export class InputBase {
  protected readonly input = inject(INPUT_TOKEN);

  @ViewChild(NATIVE_INPUT_REF_TOKEN)
  set nativeInputRef(value: NativeInputRefDirective) {
    this.input._setNativeInputRef(value);
  }
}
