import { AsyncPipe } from '@angular/common';
import { Component, ViewEncapsulation, inject } from '@angular/core';
import { BracketMatchDirective } from '../../directives/bracket-match';

@Component({
  selector: 'et-bracket-match',
  templateUrl: './bracket-match.component.html',
  styleUrls: ['./bracket-match.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-bracket-match',
  },
  imports: [AsyncPipe],
  hostDirectives: [BracketMatchDirective],
})
export class BracketMatchComponent {
  matchData = inject(BracketMatchDirective);
}
