import { Directive, inject, ViewChild } from '@angular/core';
import { INPUT_TOKEN } from '../directives/input';
import { NATIVE_INPUT_REF_TOKEN, NativeInputRefDirective } from '../directives/native-input-ref';

@Directive()
export class InputBase {
  private readonly __nativeInputRef = inject(NATIVE_INPUT_REF_TOKEN, { optional: true });
  protected readonly input = inject(INPUT_TOKEN);

  @ViewChild(NATIVE_INPUT_REF_TOKEN)
  set nativeInputRef(value: NativeInputRefDirective) {
    if (this.__nativeInputRef) return;

    this.input._setNativeInputRef(value);
  }

  constructor() {
    if (this.__nativeInputRef) {
      this.input._setNativeInputRef(this.__nativeInputRef);
    }
  }
}
