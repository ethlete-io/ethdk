import { BRACKET_ERROR_CODES } from './bracket-errors';
import { BracketRuntimeError } from './bracket-runtime-error';
import { TournamentMode } from './core';

export type BracketLayoutRegistration = {
  name: string;
  mode: TournamentMode;
};

const LAYOUT_FACTORY_SUGGESTION: Record<TournamentMode, string> = {
  'single-elimination': 'singleEliminationBracketLayout()',
  'double-elimination': 'doubleEliminationBracketLayout()',
  'swiss-with-elimination': 'swissBracketLayout()',
};

/** Returns the first registered layout matching the tournament mode. */
export const resolveBracketLayout = <TLayout extends BracketLayoutRegistration>(
  layouts: readonly TLayout[] | undefined,
  mode: TournamentMode,
): TLayout => {
  const layout = layouts?.find((candidate) => candidate.mode === mode);

  if (!layout) {
    throw new BracketRuntimeError(
      BRACKET_ERROR_CODES.LAYOUT_NOT_REGISTERED,
      `No bracket layout registered for mode "${mode}". Add ${LAYOUT_FACTORY_SUGGESTION[mode]} to provideBracketConfig({ layouts: [...] }) or to the layouts input.`,
    );
  }

  return layout;
};
