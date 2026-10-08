import {
  COMMON_BRACKET_ROUND_TYPE,
  DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE,
  BracketComponents,
  BracketContinueComponent,
  BracketMatchComponent,
  BracketRoundHeaderComponent,
  Bracket,
  BracketRound,
} from '@ethlete/bracket';
import { RuntimeError } from '@ethlete/core';
import { BracketConfig } from './bracket.config';
import { BRACKET_ERROR_CODES } from './bracket-errors';

/**
 * The cards a host component was told to draw with, each `undefined` where its input was left unset.
 */
export type BracketComponentOverrides<TRoundData, TMatchData> = {
  roundHeader?: BracketRoundHeaderComponent<TRoundData, TMatchData>;
  match?: BracketMatchComponent<TRoundData, TMatchData>;
  finalMatch?: BracketMatchComponent<TRoundData, TMatchData>;
  continue?: BracketContinueComponent<TRoundData, TMatchData>;
};

const cardNotRegistered = (card: string) =>
  new RuntimeError(
    BRACKET_ERROR_CODES.CARD_NOT_REGISTERED,
    ngDevMode
      ? `The bracket has no ${card} card. Spread BRACKET_DEFAULT_CARDS into provideBracketConfig({ ... }), or bind a card of your own.`
      : '',
  );

/**
 * Which component draws each kind of cell: the host's own inputs first, the active layout's cards
 * second (`swissBracketLayout({ matchComponent })`), `provideBracketConfig` last. The final falls back
 * to the match card. Throws `ET3414` for a match or round header card nothing names, and for a missing
 * continue card while the continue element is shown.
 *
 * Shared so that every representation of a bracket - the grid and the rounds list - picks the same card
 * for the same source.
 *
 * @internal
 */
export const resolveBracketComponents = <TRoundData, TMatchData>(options: {
  overrides: BracketComponentOverrides<TRoundData, TMatchData>;
  config: BracketConfig<TRoundData, TMatchData>;
  layoutComponents: BracketComponentOverrides<TRoundData, TMatchData> | undefined;
  showsContinueElement: boolean;
}): BracketComponents<TRoundData, TMatchData> => {
  const { overrides, config, layoutComponents } = options;

  const match = overrides.match ?? layoutComponents?.match ?? config.matchComponent;
  const roundHeader = overrides.roundHeader ?? layoutComponents?.roundHeader ?? config.roundHeaderComponent;
  const continueCard = overrides.continue ?? layoutComponents?.continue ?? config.continueComponent;

  if (!match) throw cardNotRegistered('match');
  if (!roundHeader) throw cardNotRegistered('round header');
  if (options.showsContinueElement && !continueCard) throw cardNotRegistered('continue');

  return {
    match,
    finalMatch: overrides.finalMatch ?? layoutComponents?.finalMatch ?? config.finalMatchComponent ?? match,
    roundHeader,
    continue: continueCard,
  };
};

/**
 * Whether a round's matches get the *final* card rather than the ordinary one.
 *
 * The last match played is the one that decides the tournament, which in a double elimination bracket
 * with a bracket-reset final is the reverse final rather than the grand final - mirrors the rule the grid
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
