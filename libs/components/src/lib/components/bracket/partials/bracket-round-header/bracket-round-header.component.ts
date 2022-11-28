import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { BRACKET_ROUND_DATA_TOKEN } from '../../constants';

@Component({
  selector: 'et-bracket-round-header',
  templateUrl: './bracket-round-header.component.html',
  styleUrls: ['./bracket-round-header.component.scss'],
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'et-bracket-round-header',
  },
})
export class BracketRoundHeaderComponent {
  data = inject(BRACKET_ROUND_DATA_TOKEN);
}
