import { afterNextRender, computed, inject, InjectionToken, Signal } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { MatchCardSize, NormalizedMatch } from '../match';
import { BRACKET_ERROR_CODES } from './bracket-errors';
import { BracketMatch } from './linked';

/**
 * Turns one of *your* bracket matches into the shape the default cards draw
 * ({@link NormalizedMatch}). The bracket itself never looks inside `TMatchData` — it carries your
 * payload from the data source to the cards untouched — so this is the one place a shape is named.
 *
 * It receives the whole linked match rather than just `data`, which means a consumer whose payload
 * holds nothing presentational can still build a card out of what the bracket knows: participant ids,
 * `winnerSide`, `status`, the round.
 *
 * @example
 * provideBracketConfig({ matchNormalizer: (match) => normalizeEthleteMatch(match.data) });
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BracketMatchNormalizer<TRoundData = any, TMatchData = any> = (
  match: BracketMatch<TRoundData, TMatchData>,
) => NormalizedMatch;

/**
 * What the bracket's default cards need from the bracket around them. Provided by `et-bracket`, which
 * resolves each value from its own input first and its `provideBracketConfig` second.
 *
 * A card of your own doesn't need any of this — it gets everything through its inputs — which is why
 * every member here is read optionally.
 */
export type BracketCardContext = {
  /** The normalizer in effect, or `null` when the app registered none. */
  resolvedMatchNormalizer: Signal<BracketMatchNormalizer | null>;
  /** The `aria-level` the default round headers announce themselves at. */
  resolvedRoundHeaderLevel: Signal<number>;
  /**
   * The `size` the default **final** card pins its `et-match-card` to.
   *
   * `'auto'` in the grid, where a cell has a deliberate width and letting the card measure it is the
   * point — a narrow final column should land on the dense row rather than crop. A list row is instead
   * as wide as the page, so an unpinned final would flip to the wide side-by-side arrangement past
   * 560px while every row above it stayed dense.
   */
  resolvedFinalMatchCardSize: Signal<MatchCardSize>;
};

export const BRACKET_CARD_CONTEXT = new InjectionToken<BracketCardContext>('BRACKET_CARD_CONTEXT');

/**
 * The normalized match a default card draws, or `null` when there is no normalizer to produce one.
 *
 * Dev mode throws instead of rendering an empty card: a bracket whose cards silently show nothing is a
 * much worse afternoon than one that says which provider is missing.
 *
 * Named `create…` rather than `inject…` even though it injects: it takes the card's own match input, so
 * it has to be declared after it — which the class-member-order rule only allows for non-`inject` members.
 *
 * @internal
 */
export const createNormalizedBracketMatch = <TRoundData, TMatchData>(
  bracketMatch: Signal<BracketMatch<TRoundData, TMatchData>>,
) => {
  const context = inject(BRACKET_CARD_CONTEXT, { optional: true });

  const normalizer = computed(() => context?.resolvedMatchNormalizer() ?? null);

  if (ngDevMode) {
    afterNextRender(() => {
      if (normalizer()) return;

      throw new RuntimeError(
        BRACKET_ERROR_CODES.MISSING_MATCH_NORMALIZER,
        "[BracketComponent] The bracket's default match cards need a matchNormalizer to know how to read your " +
          'match data. Add one to provideBracketConfig({ matchNormalizer: (match) => … }) or bind ' +
          '[matchNormalizer] on <et-bracket> — or supply your own matchComponent / finalMatchComponent instead.',
      );
    });
  }

  return computed(() => {
    const normalize = normalizer();

    return normalize ? normalize(bracketMatch()) : null;
  });
};
