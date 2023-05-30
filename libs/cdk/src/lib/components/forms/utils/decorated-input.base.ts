import { AfterContentInit, ContentChildren, Directive, inject } from '@angular/core';
import { TypedQueryList, createDestroy, createReactiveBindings } from '@ethlete/core';
import { map, startWith, takeUntil } from 'rxjs';
import { INPUT_PREFIX_TOKEN, INPUT_SUFFIX_TOKEN, InputPrefixDirective, InputSuffixDirective } from '../directives';
import { FormFieldStateService } from '../services';
import { InputBase } from './input.base';

@Directive()
export class DecoratedInputBase extends InputBase implements AfterContentInit {
  private readonly _formFieldStateService = inject(FormFieldStateService);
  readonly _destroy$ = createDestroy();

  @ContentChildren(INPUT_PREFIX_TOKEN)
  protected readonly inputPrefix?: TypedQueryList<InputPrefixDirective>;

  @ContentChildren(INPUT_SUFFIX_TOKEN)
  protected readonly inputSuffix?: TypedQueryList<InputSuffixDirective>;

  readonly _bindings = createReactiveBindings(
    {
      attribute: 'class.et-input--has-prefix',
      observable: this._formFieldStateService.hasPrefix$,
    },
    {
      attribute: 'class.et-input--has-suffix',
      observable: this._formFieldStateService.hasSuffix$,
    },
  );

  ngAfterContentInit(): void {
    if (!this.inputPrefix || !this.inputSuffix) {
      return;
    }

    this.inputPrefix.changes
      .pipe(
        takeUntil(this._destroy$),
        startWith(this.inputPrefix),
        map((list) => list.length > 0),
      )
      .subscribe(this._formFieldStateService.hasPrefix$);

    this.inputSuffix.changes
      .pipe(
        takeUntil(this._destroy$),
        startWith(this.inputSuffix),
        map((list) => list.length > 0),
      )
      .subscribe(this._formFieldStateService.hasSuffix$);
  }
}
