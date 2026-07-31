import {
  COMMON_BRACKET_ROUND_TYPE,
  DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE,
  TOURNAMENT_MODE,
  TournamentMode,
} from './core';
import {
  BracketComponents,
  BracketContinueComponent,
  BracketMatchComponent,
  BracketRoundHeaderComponent,
} from './drawing/grid';
import { Bracket, BracketRound } from './linked';
import { BracketDefaultContinueComponent } from './bracket-default-continue.component';
import { BracketDefaultFinalMatchComponent } from './bracket-default-final-match.component';
import { BracketDefaultMatchComponent } from './bracket-default-match.component';
import { BracketDefaultRoundHeaderComponent } from './bracket-default-round-header.component';
import { BracketConfig } from './bracket.config';

/**
 * The cards a host component was told to draw with, each `undefined` where its input was left unset.
 *
 * @internal
 */
export type BracketComponentOverrides<TRoundData, TMatchData> = {
  roundHeader?: BracketRoundHeaderComponent<TRoundData, TMatchData>;
  match?: BracketMatchComponent<TRoundData, TMatchData>;
  finalMatch?: BracketMatchComponent<TRoundData, TMatchData>;
  continue?: BracketContinueComponent<TRoundData, TMatchData>;
};

/**
 * Which component draws each kind of cell: the host's own inputs first, the swiss overrides of
 * `provideBracketConfig` second (swiss sources only), its top-level ones third, the shipped defaults last.
 *
 * Shared so that every representation of a bracket — the grid and the rounds list — picks the same card
 * for the same source.
 *
 * @internal
 */
export const resolveBracketComponents = <TRoundData, TMatchData>(
  overrides: BracketComponentOverrides<TRoundData, TMatchData>,
  config: BracketConfig<TRoundData, TMatchData>,
  mode: TournamentMode,
  // eslint-disable-next-line max-params -- mirrors the grid builders' (overrides, config, mode) shape
): BracketComponents<TRoundData, TMatchData> => {
  const swiss = mode === TOURNAMENT_MODE.SWISS_WITH_ELIMINATION ? config.swiss : undefined;

  return {
    match: overrides.match ?? swiss?.matchComponent ?? config.matchComponent ?? BracketDefaultMatchComponent,
    finalMatch: overrides.finalMatch ?? config.finalMatchComponent ?? BracketDefaultFinalMatchComponent,
    roundHeader:
      overrides.roundHeader ??
      swiss?.roundHeaderComponent ??
      config.roundHeaderComponent ??
      BracketDefaultRoundHeaderComponent,
    continue: overrides.continue ?? config.continueComponent ?? BracketDefaultContinueComponent,
  };
};

/**
 * Whether a round's matches get the *final* card rather than the ordinary one.
 *
 * The last match played is the one that decides the tournament, which in a double elimination bracket
 * with a bracket-reset final is the reverse final rather than the grand final — mirrors the rule the grid
 * applies in `createBracketSubColumnRelativeToFirstRound`.
 *
 * @internal
 */
export const usesBracketFinalCard = <TRoundData, TMatchData>(
  round: BracketRound<TRoundData, TMatchData>,
  bracket: Bracket<TRoundData, TMatchData>,
) => {
  const hasReverseFinal = !!bracket.roundsByType.get(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL)?.first();

  return (
    round.type ===
    (hasReverseFinal ? DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL : COMMON_BRACKET_ROUND_TYPE.FINAL)
  );
};
