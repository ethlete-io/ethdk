import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { InputDirective, NativeInputRefDirective } from '../../../../directives';
import { DecoratedInputBase } from '../../../../utils';
import { SEARCH_INPUT_TOKEN, SearchInputDirective } from '../../directives';

@Component({
  selector: 'et-search-input',
  templateUrl: './search-input.component.html',
  styleUrls: ['./search-input.component.scss'],
  standalone: true,
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
