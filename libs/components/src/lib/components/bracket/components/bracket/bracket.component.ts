import { NgClass, NgForOf, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, TrackByFunction, ViewEncapsulation } from '@angular/core';
import { LetDirective, Memo } from '@ethlete/core';
import { BracketMatch, BracketRound, result } from './test';

interface ConnectedMatches {
  previousMatches: (BracketMatch | null)[] | null;
  nextMatch: BracketMatch | null;
}

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
  result = result;

  trackByRound: TrackByFunction<BracketRound> = (_, round) => round.data.id;
  trackByMatch: TrackByFunction<BracketMatch> = (_, match) => match.data.id;

  @Memo()
  _getRoundById(id: string) {
    return this.result.rounds.find((round) => round.data.id === id) ?? null;
  }

  @Memo({ resolver: (match: BracketMatch) => `${match.data.id}-${match.previousMatches?.roundId ?? null}` })
  _getPreviousMatches(match: BracketMatch) {
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
  _getNextMatch(match: BracketMatch) {
    if (!match.nextMatch) {
      return null;
    }

    const { roundId, matchId } = match.nextMatch;

    const round = this._getRoundById(roundId);

    return round?.matches.find((match) => match.data.id === matchId) ?? null;
  }

  @Memo({ resolver: (match: BracketMatch) => `${match.data.id}-${match.previousMatches?.roundId ?? null}` })
  getConnectedMatches(match: BracketMatch): ConnectedMatches {
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
  getChildConnectorShape(currentMatch: BracketMatch, nextMatch: BracketMatch | null) {
    if (!nextMatch) {
      return null;
    }

    const nextMatchPreviousMatches = nextMatch.previousMatches?.matchIds;

    if (!nextMatchPreviousMatches) {
      return null;
    }

    const nextMatchPreviousMatchA = nextMatchPreviousMatches[0];
    const nextMatchPreviousMatchB = nextMatchPreviousMatches[1];

    if (currentMatch.data.id === '572b1ac3-c67a-4be1-ad42-0c6ae6f60792loo') {
      console.log({ nextMatchPreviousMatchA, nextMatchPreviousMatchB, currentMatch, nextMatchPreviousMatches });
    }

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
  getLineMultiAfter(roundIndex: number) {
    const isDoubleElimination = this.result.mode === 'double';
    const currentRound = this.result.rounds[roundIndex];
    const nextRound = this.result.rounds[roundIndex + 1];

    // for connecting the last looser match and the respective semi final winner match
    if (isDoubleElimination && !nextRound && currentRound.data.bracket === 'looser') {
      return result.totalRows - 2;
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
        const totalWinnerRounds = this.result.rounds.filter(
          (round) => round.data.bracket === 'winner' || !round.data.bracket,
        ).length;
        const looserRoundIndex = currentRound.data.bracket === 'looser' ? roundIndex - totalWinnerRounds : roundIndex;

        rndIndex = looserRoundIndex / 2;
      }

      return 2 ** rndIndex;
    }
  }

  getLineMultiBefore(round: BracketRound, previousRound: BracketRound | null) {
    const roundSpanMulti = round.column.end - round.column.start;
    const previousRoundSpanMulti = (previousRound?.column.end ?? 0) - (previousRound?.column.start ?? 0);

    if (roundSpanMulti && previousRoundSpanMulti) {
      return roundSpanMulti;
    } else if (roundSpanMulti) {
      return roundSpanMulti - 1;
    } else if (previousRoundSpanMulti) {
      return previousRoundSpanMulti - 1;
    }

    return 0;
  }
}
