import { NgClass, NgForOf } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { Memo } from '@ethlete/core';
import { loserBracketRows, winnerBracketRows } from './bracket.component.constants';

@Component({
  selector: 'et-bracket',
  templateUrl: './bracket.component.html',
  styleUrls: ['./bracket.component.scss'],
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, NgForOf],
  host: {
    class: 'et-bracket',
  },
})
export class BracketComponent {
  winner = winnerBracketRows;
  loser = loserBracketRows;

  @Memo()
  calcRow(matchIndex: number, firstRoundLength: number, currentRoundLength: number) {
    const rowSpan = firstRoundLength / currentRoundLength;

    const rowStart = matchIndex * rowSpan + 1;
    const rowEnd = rowStart + rowSpan;

    return `${rowStart} / ${rowEnd}`;
  }

  @Memo()
  calcLineMulti(roundIndex: number, nextRoundLength: number, currentRoundLength: number) {
    if (nextRoundLength === currentRoundLength) {
      return 1;
    }

    return 2 ** roundIndex;
  }
}
