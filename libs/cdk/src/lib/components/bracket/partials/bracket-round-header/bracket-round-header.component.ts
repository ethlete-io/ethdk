import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { BracketRoundDirective } from '../../directives/bracket-round';

@Component({
  selector: 'et-bracket-round-header',
  templateUrl: './bracket-round-header.component.html',
  styleUrls: ['./bracket-round-header.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'et-bracket-round-header',
  },
  imports: [AsyncPipe],
  hostDirectives: [BracketRoundDirective],
})
export class BracketRoundHeaderComponent {
  roundData = inject(BracketRoundDirective);
}
