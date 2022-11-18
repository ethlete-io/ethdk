import { AsyncPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { BracketMatchDirective } from '../../directives';

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
  imports: [AsyncPipe, NgIf],
  hostDirectives: [BracketMatchDirective],
})
export class BracketMatchBodyComponent {
  matchData = inject(BracketMatchDirective);
}
