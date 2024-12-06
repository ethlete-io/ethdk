import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { BracketMatchDirective } from '../../directives/bracket-match';

@Component({
  selector: 'et-bracket-match',
  templateUrl: './bracket-match.component.html',
  styleUrls: ['./bracket-match.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'et-bracket-match',
  },
  imports: [AsyncPipe],
  hostDirectives: [BracketMatchDirective],
})
export class BracketMatchComponent {
  matchData = inject(BracketMatchDirective);
}
