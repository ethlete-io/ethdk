import { computed, effect, Signal } from '@angular/core';
import { BracketWarning } from '@ethlete/bracket';
import { BracketMatchNormalizer } from './bracket-card-context';
import { BracketLayout, resolveBracketLayout } from './bracket-layout';
import { BracketConfig } from './bracket.config';
import { BracketDataSource } from './integrations';

/**
 * The layout a bracket host draws with: its `layouts` input first, `provideBracketConfig` second.
 * Throws `ET3413` when none matches the source's mode.
 *
 * @internal
 */
export const createBracketHostLayout = <TRoundData, TMatchData>(
  layouts: Signal<readonly BracketLayout<TRoundData, TMatchData>[] | undefined>,
  source: Signal<BracketDataSource<TRoundData, TMatchData>>,
  config: BracketConfig,
  // eslint-disable-next-line max-params -- the host's two inputs plus the config they fall back to
) =>
  computed(() =>
    resolveBracketLayout<TRoundData, TMatchData>(
      layouts() ?? (config.layouts as readonly BracketLayout<TRoundData, TMatchData>[] | undefined),
      source().mode,
    ),
  );

/**
 * The normalizer a bracket host hands its default cards: its `matchNormalizer` input first,
 * `provideBracketConfig` second.
 *
 * @internal
 */
export const createBracketHostMatchNormalizer = <TRoundData, TMatchData>(
  matchNormalizer: Signal<BracketMatchNormalizer<TRoundData, TMatchData> | undefined>,
  config: BracketConfig,
) => computed<BracketMatchNormalizer | null>(() => matchNormalizer() ?? config.matchNormalizer ?? null);

/** @internal */
export const bracketHostWarningHandler = (): ((warning: BracketWarning) => void) | undefined =>
  ngDevMode ? (warning) => console.warn(`[et-bracket] ${warning.message}`) : undefined;

/** @internal */
export const warnUnknownBracketRoundIds = (
  source: Signal<BracketDataSource<unknown, unknown>>,
  roundIds: Record<string, () => string | null | undefined>,
) => {
  if (!ngDevMode) return;

  const warned = new Set<string>();

  effect(() => {
    const known = source().rounds.map((round) => round.id);

    for (const [inputName, read] of Object.entries(roundIds)) {
      const roundId = read();
      const key = `${inputName}:${roundId}`;

      if (!roundId || known.includes(roundId) || warned.has(key)) continue;

      warned.add(key);
      console.warn(`[et-bracket] ${inputName} "${roundId}" names no round in the source (known: ${known.join(', ')}).`);
    }
  });
};
