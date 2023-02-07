import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, Input, ViewEncapsulation } from '@angular/core';
import { INPUT_TOKEN } from '../../../../directives';
import { SEARCH_INPUT_TOKEN } from '../../directives';

@Component({
  selector: 'et-search-input-clear',
  templateUrl: './search-input-clear.component.html',
  styleUrls: ['./search-input-clear.component.scss'],
  standalone: true,
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
