import { AsyncPipe, DatePipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { BracketMatchDirective } from '../../directives';

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
  imports: [DatePipe, AsyncPipe, NgIf],
  hostDirectives: [BracketMatchDirective],
})
export class BracketMatchHeaderComponent {
  matchData = inject(BracketMatchDirective);
}
