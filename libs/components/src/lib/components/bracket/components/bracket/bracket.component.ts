import { NgClass, NgForOf, NgIf } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  TrackByFunction,
  ViewEncapsulation,
} from '@angular/core';
import { LetDirective, Memo } from '@ethlete/core';
import { BracketMatch, BracketRound, ConnectedMatches, RoundWithMatchesView } from './bracket.component.types';
import { Bracket } from './bracket.utils';

@Component({
  selector: 'et-bracket',
  templateUrl: './bracket.component.html',
  styleUrls: ['./bracket.component.scss'],
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, NgForOf, LetDirective, NgIf],
  host: {
    class: 'et-bracket',
  },
})
export class BracketComponent {
  private _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  get itemWith() {
    return this._itemWith;
  }
  set itemWith(v: string) {
    this._itemWith = v;

    this._elementRef.nativeElement.style.setProperty('--_bracket-item-width', v);
  }
  private _itemWith!: string;

  get itemHeight() {
    return this._itemHeight;
  }
  set itemHeight(v: string) {
    this._itemHeight = v;
    this._elementRef.nativeElement.style.setProperty('--_bracket-item-height', v);
  }
  private _itemHeight!: string;

  get columnGap() {
    return this._columnGap;
  }
  set columnGap(v: string) {
    this._columnGap = v;
    this._elementRef.nativeElement.style.setProperty('--_bracket-column-gap', v);
  }
  private _columnGap!: string;

  get rowGap() {
    return this._rowGap;
  }
  set rowGap(v: string) {
    this._rowGap = v;
    this._elementRef.nativeElement.style.setProperty('--_bracket-row-gap', v);
  }
  private _rowGap!: string;

  get roundsWithMatches() {
    return this._roundsWithMatches;
  }
  set roundsWithMatches(v: RoundWithMatchesView[] | null | undefined) {
    this._roundsWithMatches = v;

    if (!v) {
      this._bracket = null;
    } else {
      this._bracket = new Bracket(v);
    }

    this._elementRef.nativeElement.style.setProperty('--_total-rounds', (this._bracket?.totalColCount ?? 0).toString());
  }
  private _roundsWithMatches!: RoundWithMatchesView[] | null | undefined;

  protected _bracket: Bracket | null = null;

  trackByRound: TrackByFunction<BracketRound> = (_, round) => round.data.id;
  trackByMatch: TrackByFunction<BracketMatch> = (_, match) => match.data.id;

  @Memo()
  private _getRoundById(id: string) {
    if (!this._bracket) {
      throw new Error('No bracket found');
    }

    return this._bracket?.bracketRounds.find((round) => round.data.id === id) ?? null;
  }

  @Memo({ resolver: (match: BracketMatch) => `${match.data.id}-${match.previousMatches?.roundId ?? null}` })
  private _getPreviousMatches(match: BracketMatch) {
    if (!match.previousMatches) {
      return null;
    }

    const { roundId, matchIds } = match.previousMatches;

    const round = this._getRoundById(roundId);

    return matchIds.map((matchId: string) => {
      return round?.matches.find((match) => match.data.id === matchId) ?? null;
    });
  }

  @Memo({ resolver: (match: BracketMatch) => `${match.data.id}-${match.previousMatches?.roundId ?? null}` })
  private _getNextMatch(match: BracketMatch) {
    if (!match.nextMatch) {
      return null;
    }

    const { roundId, matchId } = match.nextMatch;

    const round = this._getRoundById(roundId);

    return round?.matches.find((match) => match.data.id === matchId) ?? null;
  }

  @Memo({ resolver: (match: BracketMatch) => `${match.data.id}-${match.previousMatches?.roundId ?? null}` })
  protected getConnectedMatches(match: BracketMatch): ConnectedMatches {
    const previousMatches = this._getPreviousMatches(match);
    const nextMatch = this._getNextMatch(match);

    return {
      previousMatches,
      nextMatch,
    };
  }

  @Memo({
    resolver: (currentMatch: BracketMatch, nextMatch: BracketMatch | null) =>
      `${currentMatch.data.id}-${nextMatch?.previousMatches?.roundId ?? null}`,
  })
  protected getChildConnectorShape(currentMatch: BracketMatch, nextMatch: BracketMatch | null) {
    if (!nextMatch) {
      return null;
    }

    const nextMatchPreviousMatches = nextMatch.previousMatches?.matchIds;

    if (!nextMatchPreviousMatches) {
      return null;
    }

    const nextMatchPreviousMatchA = nextMatchPreviousMatches[0];
    const nextMatchPreviousMatchB = nextMatchPreviousMatches[1];

    if (nextMatchPreviousMatches.length === 1) {
      return 'straight';
    }

    if (currentMatch.data.id === nextMatchPreviousMatchA) {
      return 'down';
    }

    if (currentMatch.data.id === nextMatchPreviousMatchB) {
      return 'up';
    }

    return null;
  }

  @Memo()
  protected getLineMultiAfter(roundIndex: number) {
    if (!this._bracket) {
      throw new Error('No bracket found');
    }

    const isDoubleElimination = this._bracket.bracketType === 'double';
    const currentRound = this._bracket.bracketRounds[roundIndex];
    const nextRound = this._bracket.bracketRounds[roundIndex + 1];

    // for connecting the last looser match and the respective semi final winner match
    if (isDoubleElimination && !nextRound && currentRound.data.bracket === 'looser') {
      return this._bracket.totalRowCount - 2;
    }

    if (!nextRound) {
      return 1;
    }

    if (nextRound.matches.length === currentRound.matches.length) {
      return 1;
    }

    if (!isDoubleElimination) {
      return 2 ** roundIndex;
    } else {
      let rndIndex = roundIndex;

      if (currentRound.data.bracket === 'looser') {
        const totalWinnerRounds = this._bracket.winnerRoundCount;
        const looserRoundIndex = currentRound.data.bracket === 'looser' ? roundIndex - totalWinnerRounds : roundIndex;

        rndIndex = looserRoundIndex / 2;
      }

      return 2 ** rndIndex;
    }
  }

  @Memo({
    resolver: (round: BracketRound | null) => `${round?.data.id}`,
  })
  protected getLineSpan(round: BracketRound | null) {
    if (!round) {
      return 0;
    }

    return round.column.end - round.column.start;
  }
}
