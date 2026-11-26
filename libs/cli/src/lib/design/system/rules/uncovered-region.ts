import { UncoveredState } from '../live-uncovered';
import { Problem } from '../problem';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { regionTextOf, UNCOVERED_HINT } from '../uncovered-regions';

export const UNCOVERED_REGION_RULE = 'UNCOVERED-REGION';

/**
 * One `UNCOVERED-REGION` problem per region a live page shows, listing the states that show it, and one per state
 * that did not open; each on the page part of the live spec, or on `(product)` when no part has that key.
 */
export const uncoveredRegionProblemsOf = (options: {
  product: ResolvedProduct;
  live: string;
  states: UncoveredState[];
}): Map<string, Problem[]> => {
  const keys = new Set(options.product.parts.map(partKeyOf));
  const found = new Map<string, { part: string; message: string; states: string[] }>();

  for (const state of options.states) {
    const part = keys.has(state.page) ? state.page : '(product)';
    const messages =
      'problem' in state
        ? [`the live page did not open: ${state.problem}`]
        : state.regions.map((region) => `${regionTextOf(region)} - ${UNCOVERED_HINT}`);

    for (const message of messages) {
      const key = `${part}\0${state.page}\0${message}`;
      const entry = found.get(key) ?? { part, message, states: [] };

      entry.states.push(`${state.page} ${state.state}`);
      found.set(key, entry);
    }
  }

  const problems = new Map<string, Problem[]>();

  for (const { part, message, states } of found.values())
    problems.set(part, [
      ...(problems.get(part) ?? []),
      { rule: UNCOVERED_REGION_RULE, file: options.live, message: `${states.join(', ')}: ${message}` },
    ]);

  return problems;
};
