import { Directive, inject, ViewChild } from '@angular/core';
import { INPUT_TOKEN } from '../directives/input';
import { NATIVE_INPUT_REF_TOKEN, NativeInputRefDirective } from '../directives/native-input-ref';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive()
export class InputBase {
  private readonly __nativeInputRef = inject(NATIVE_INPUT_REF_TOKEN, { optional: true });
  protected readonly input = inject(INPUT_TOKEN);

  // TODO: Skipped for migration because:
  //  Accessor queries cannot be migrated as they are too complex.
  // TODO: Skipped for migration because:
  //  Accessor queries cannot be migrated as they are too complex.
  // TODO: Skipped for migration because:
  //  Accessor queries cannot be migrated as they are too complex.
  // TODO: Skipped for migration because:
  //  Accessor queries cannot be migrated as they are too complex.
  // TODO: Skipped for migration because:
  //  Accessor queries cannot be migrated as they are too complex.
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
