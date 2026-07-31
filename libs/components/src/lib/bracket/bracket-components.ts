import { COMMON_BRACKET_ROUND_TYPE, DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE } from './core';
import {
  BracketComponents,
  BracketContinueComponent,
  BracketMatchComponent,
  BracketRoundHeaderComponent,
} from './drawing/grid/core/types';
import { Bracket, BracketRound } from './linked/bracket';
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
 * Which component draws each kind of cell: the host's own inputs first, the active layout's cards
 * second (`swissBracketLayout({ matchComponent })`), `provideBracketConfig` third, the shipped
 * defaults last.
 *
 * Shared so that every representation of a bracket — the grid and the rounds list — picks the same card
 * for the same source.
 *
 * @internal
 */
export const resolveBracketComponents = <TRoundData, TMatchData>(
  overrides: BracketComponentOverrides<TRoundData, TMatchData>,
  config: BracketConfig<TRoundData, TMatchData>,
  layoutComponents: BracketComponentOverrides<TRoundData, TMatchData> | undefined,
  // eslint-disable-next-line max-params -- the precedence chain, one argument per link
): BracketComponents<TRoundData, TMatchData> => ({
  match: overrides.match ?? layoutComponents?.match ?? config.matchComponent ?? BracketDefaultMatchComponent,
  finalMatch:
    overrides.finalMatch ??
    layoutComponents?.finalMatch ??
    config.finalMatchComponent ??
    BracketDefaultFinalMatchComponent,
  roundHeader:
    overrides.roundHeader ??
    layoutComponents?.roundHeader ??
    config.roundHeaderComponent ??
    BracketDefaultRoundHeaderComponent,
  continue:
    overrides.continue ?? layoutComponents?.continue ?? config.continueComponent ?? BracketDefaultContinueComponent,
});

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
