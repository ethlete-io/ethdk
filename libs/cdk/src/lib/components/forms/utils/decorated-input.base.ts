import { ContentChildren, Directive, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { TypedQueryList, createDestroy, signalHostClasses, switchQueryListChanges } from '@ethlete/core';
import { BehaviorSubject, map, tap } from 'rxjs';
import { INPUT_PREFIX_TOKEN, InputPrefixDirective } from '../directives/input-prefix';
import { INPUT_SUFFIX_TOKEN, InputSuffixDirective } from '../directives/input-suffix';
import { FormFieldStateService } from '../services';
import { InputBase } from './input.base';

@Directive()
export class DecoratedInputBase extends InputBase {
  private readonly _formFieldStateService = inject(FormFieldStateService);
  readonly _destroy$ = createDestroy();

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
  @ContentChildren(INPUT_PREFIX_TOKEN)
  set inputPrefix(inputPrefix: TypedQueryList<InputPrefixDirective>) {
    this.inputPrefix$.next(inputPrefix);
  }
  protected readonly inputPrefix$ = new BehaviorSubject<TypedQueryList<InputPrefixDirective> | null>(null);

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
  @ContentChildren(INPUT_SUFFIX_TOKEN)
  set inputSuffix(inputSuffix: TypedQueryList<InputSuffixDirective>) {
    this.inputSuffix$.next(inputSuffix);
  }
  protected readonly inputSuffix$ = new BehaviorSubject<TypedQueryList<InputSuffixDirective> | null>(null);

  readonly hasPrefix$ = this.inputPrefix$.pipe(
    switchQueryListChanges(),
    map((list) => !!list && list?.length > 0),
  );
  readonly hasSuffix$ = this.inputSuffix$.pipe(
    switchQueryListChanges(),
    map((list) => !!list && list?.length > 0),
  );

  readonly hostClassBindings = signalHostClasses({
    'et-input--has-prefix': toSignal(this.hasPrefix$),
    'et-input--has-suffix': toSignal(this.hasSuffix$),
  });

  constructor() {
    super();

    this.hasPrefix$
      .pipe(
        takeUntilDestroyed(),
        tap((hasPrefix) => this._formFieldStateService.hasPrefix$.next(hasPrefix)),
      )
      .subscribe();

    this.hasSuffix$
      .pipe(
        takeUntilDestroyed(),
        tap((hasSuffix) => this._formFieldStateService.hasSuffix$.next(hasSuffix)),
      )
      .subscribe();
  }
}
