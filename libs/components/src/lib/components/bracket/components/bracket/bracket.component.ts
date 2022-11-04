import { ComponentPortal, ComponentType, PortalModule } from '@angular/cdk/portal';
import { NgClass, NgForOf, NgIf } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  Input,
  TrackByFunction,
  ViewEncapsulation,
} from '@angular/core';
import { LetDirective, Memo } from '@ethlete/core';
import { RoundStageStructureWithMatchesView } from '@ethlete/types';
import { BRACKET_CONFIG_TOKEN, BRACKET_MATCH_DATA_TOKEN, BRACKET_ROUND_DATA_TOKEN } from '../../constants';
import { BracketConfig, BracketMatch, BracketRound } from '../../types';
import { Bracket, mergeBracketConfig, orderRounds } from '../../utils';
import { ConnectedMatches } from './bracket.component.types';

@Component({
  selector: 'et-bracket',
  templateUrl: './bracket.component.html',
  styleUrls: ['./bracket.component.scss'],
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, NgForOf, LetDirective, NgIf, PortalModule],
  host: {
    class: 'et-bracket',
  },
})
export class BracketComponent {
  private _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private _bracketConfig = inject(BRACKET_CONFIG_TOKEN, { optional: true });
  private _injector = inject(Injector);

  @Input()
  get itemWith() {
    return this._itemWith;
  }
  set itemWith(v: string) {
    this._itemWith = v;

    this._elementRef.nativeElement.style.setProperty('--_bracket-item-width', v);
  }
  private _itemWith = '344px';

  @Input()
  get itemHeight() {
    return this._itemHeight;
  }
  set itemHeight(v: string) {
    this._itemHeight = v;
    this._elementRef.nativeElement.style.setProperty('--_bracket-item-height', v);
  }
  private _itemHeight = '107px';

  @Input()
  get columnGap() {
    return this._columnGap;
  }
  set columnGap(v: string) {
    this._columnGap = v;
    this._elementRef.nativeElement.style.setProperty('--_bracket-column-gap', v);
  }
  private _columnGap!: string;

  @Input()
  get rowGap() {
    return this._rowGap;
  }
  set rowGap(v: string) {
    this._rowGap = v;
    this._elementRef.nativeElement.style.setProperty('--_bracket-row-gap', v);
  }
  private _rowGap!: string;

  @Input()
  get roundsWithMatches() {
    return this._roundsWithMatches;
  }
  set roundsWithMatches(v: RoundStageStructureWithMatchesView[] | null | undefined) {
    this._roundsWithMatches = v;

    if (!v || v.length === 0) {
      this._bracket = null;
      this._roundsWithMatches = null;
    } else {
      const sortedRounds = orderRounds(v);

      this._bracket = new Bracket(sortedRounds);
      this._roundsWithMatches = sortedRounds;
    }

    this._elementRef.nativeElement.style.setProperty('--_total-rounds', (this._bracket?.totalColCount ?? 0).toString());
  }
  private _roundsWithMatches!: RoundStageStructureWithMatchesView[] | null | undefined;

  @Input()
  get componentConfig() {
    return this._componentConfig;
  }
  set componentConfig(v: BracketConfig | null) {
    this._componentConfig = v;
    this._config = mergeBracketConfig(this._bracketConfig, v);
  }
  private _componentConfig: BracketConfig | null = null;

  protected _config = mergeBracketConfig(this._componentConfig, this._bracketConfig);
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
    if (isDoubleElimination && !nextRound && currentRound.data.type === 'loser_bracket') {
      return this._bracket.totalRowCount - 1;
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

      if (currentRound.data.type === 'loser_bracket') {
        const totalWinnerRounds = this._bracket.winnerRoundCount;
        const looserRoundIndex =
          currentRound.data.type === 'loser_bracket' ? roundIndex - totalWinnerRounds : roundIndex;

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

  @Memo({
    resolver: (round: BracketRound) => `${round.data.id}`,
  })
  protected createRoundPortal(round: BracketRound, component: ComponentType<unknown>) {
    const injector = Injector.create({
      providers: [
        {
          provide: BRACKET_ROUND_DATA_TOKEN,
          useValue: round,
        },
      ],
      parent: this._injector,
    });

    const portal = new ComponentPortal(component, null, injector);

    return portal;
  }

  @Memo({
    resolver: (match: BracketMatch) => `${match.data.id}`,
  })
  protected createMatchPortal(match: BracketMatch, component: ComponentType<unknown>) {
    const injector = Injector.create({
      providers: [
        {
          provide: BRACKET_MATCH_DATA_TOKEN,
          useValue: match,
        },
      ],
      parent: this._injector,
    });

    const portal = new ComponentPortal(component, null, injector);

    return portal;
  }
}
