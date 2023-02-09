import { AsyncPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { BracketRoundDirective } from '../../directives';

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
  imports: [AsyncPipe, NgIf],
  hostDirectives: [BracketRoundDirective],
})
export class BracketRoundHeaderComponent {
  roundData = inject(BracketRoundDirective);
}
