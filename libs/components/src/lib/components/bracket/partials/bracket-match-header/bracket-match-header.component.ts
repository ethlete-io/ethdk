import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { BRACKET_MATCH_DATA_TOKEN } from '../../constants';

@Component({
  selector: 'et-bracket-match-header',
  templateUrl: './bracket-match-header.component.html',
  styleUrls: ['./bracket-match-header.component.scss'],
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'et-bracket-match-header',
  },
  imports: [DatePipe],
})
export class BracketMatchHeaderComponent {
  data = inject(BRACKET_MATCH_DATA_TOKEN);
}
