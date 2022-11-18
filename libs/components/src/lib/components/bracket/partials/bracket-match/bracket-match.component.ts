import { AsyncPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { BracketMatchDirective } from '../../directives';

@Component({
  selector: 'et-bracket-match',
  templateUrl: './bracket-match.component.html',
  styleUrls: ['./bracket-match.component.scss'],
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'et-bracket-match',
  },
  imports: [AsyncPipe, NgIf],
  hostDirectives: [BracketMatchDirective],
})
export class BracketMatchComponent {
  matchData = inject(BracketMatchDirective);
}
