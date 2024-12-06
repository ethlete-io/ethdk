import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, Input, ViewEncapsulation } from '@angular/core';
import { INPUT_TOKEN } from '../../../../directives/input';
import { SEARCH_INPUT_TOKEN } from '../../directives/search-input';

@Component({
  selector: 'et-search-input-clear',
  templateUrl: './search-input-clear.component.html',
  styleUrls: ['./search-input-clear.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-search-input-clear',
  },
  imports: [AsyncPipe],
})
export class SearchInputClearComponent {
  protected readonly searchInput = inject(SEARCH_INPUT_TOKEN);
  protected readonly input = inject(INPUT_TOKEN);

  @Input()
  ariaLabel?: string;
}
