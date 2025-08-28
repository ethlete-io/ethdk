import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { InputDirective } from '../../../../directives/input';
import { NativeInputRefDirective } from '../../../../directives/native-input-ref';
import { DecoratedInputBase } from '../../../../utils';
import { SEARCH_INPUT_TOKEN, SearchInputDirective } from '../../directives/search-input';

@Component({
  selector: 'et-search-input',
  templateUrl: './search-input.component.html',
  styleUrls: ['./search-input.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-search-input',
  },
  imports: [AsyncPipe, NativeInputRefDirective],
  hostDirectives: [SearchInputDirective, { directive: InputDirective, inputs: ['autocomplete', 'placeholder'] }],
})
export class SearchInputComponent extends DecoratedInputBase {
  protected readonly searchInput = inject(SEARCH_INPUT_TOKEN);
}
