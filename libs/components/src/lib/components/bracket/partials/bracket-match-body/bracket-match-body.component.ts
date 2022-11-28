import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { BRACKET_MATCH_DATA_TOKEN } from '../../constants';

@Component({
  selector: 'et-bracket-match-body',
  templateUrl: './bracket-match-body.component.html',
  styleUrls: ['./bracket-match-body.component.scss'],
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'et-bracket-match-body',
  },
})
export class BracketMatchBodyComponent {
  data = inject(BRACKET_MATCH_DATA_TOKEN);
}
