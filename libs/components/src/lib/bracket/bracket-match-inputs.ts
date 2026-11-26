import { Type, reflectComponentType } from '@angular/core';
import { BracketMatch, BracketRound, BracketRoundSwissGroup } from '@ethlete/bracket';

/**
 * Extra inputs for a custom match card, merged over `bracketRound`, `bracketMatch` and
 * `bracketRoundSwissGroup`. A key the drawn card does not declare as an input is dropped, so the default
 * cards a custom one sits next to (such as the final) are unaffected. Signals read inside it are tracked.
 */
export type BracketMatchInputs<TRoundData, TMatchData> = (
  match: BracketMatch<TRoundData, TMatchData>,
) => Record<string, unknown>;

type BracketMatchCardSlot<TRoundData, TMatchData> = {
  round: BracketRound<TRoundData, TMatchData>;
  match: BracketMatch<TRoundData, TMatchData>;
  swissGroup: BracketRoundSwissGroup<TRoundData, TMatchData> | null;
  card: Type<unknown>;
};

const declaredInputs = (card: Type<unknown>) =>
  new Set(reflectComponentType(card)?.inputs.map((declared) => declared.templateName) ?? []);

/** @internal */
export const createBracketMatchCardInputs = <TRoundData, TMatchData>(
  slots: Iterable<BracketMatchCardSlot<TRoundData, TMatchData>>,
  extra: BracketMatchInputs<TRoundData, TMatchData> | undefined,
) => {
  const inputsById = new Map<string, Record<string, unknown>>();
  const inputsByCard = new Map<Type<unknown>, Set<string>>();

  for (const { round, match, swissGroup, card } of slots) {
    const accepted = inputsByCard.get(card) ?? declaredInputs(card);

    inputsByCard.set(card, accepted);
    inputsById.set(match.id, {
      ...Object.fromEntries(Object.entries(extra?.(match) ?? {}).filter(([key]) => accepted.has(key))),
      bracketRound: round,
      bracketMatch: match,
      bracketRoundSwissGroup: swissGroup,
    });
  }

  return inputsById;
};
