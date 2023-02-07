import { AfterContentInit, ContentChildren, Directive } from '@angular/core';
import { createReactiveBindings, TypedQueryList } from '@ethlete/core';
import { map, startWith } from 'rxjs';
import { InputPrefixDirective, InputSuffixDirective, INPUT_PREFIX_TOKEN, INPUT_SUFFIX_TOKEN } from '../directives';
import { InputBase } from './input.base';

@Directive()
export class DecoratedInputBase extends InputBase implements AfterContentInit {
  @ContentChildren(INPUT_PREFIX_TOKEN)
  protected readonly inputPrefix?: TypedQueryList<InputPrefixDirective>;

  @ContentChildren(INPUT_SUFFIX_TOKEN)
  protected readonly inputSuffix?: TypedQueryList<InputSuffixDirective>;

  readonly _bindings = createReactiveBindings();

  ngAfterContentInit(): void {
    if (!this.inputPrefix || !this.inputSuffix) {
      return;
    }

    this._bindings.push({
      attribute: 'class.et-input--has-prefix',
      observable: this.inputPrefix.changes.pipe(
        startWith(this.inputPrefix),
        map((list) => list.length > 0),
      ),
    });

    this._bindings.push({
      attribute: 'class.et-input--has-suffix',
      observable: this.inputSuffix.changes.pipe(
        startWith(this.inputSuffix),
        map((list) => list.length > 0),
      ),
    });
  }
}
