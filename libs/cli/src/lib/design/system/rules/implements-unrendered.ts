import { relative } from 'path';
import { UncoveredState } from '../live-uncovered';
import { Problem } from '../problem';
import { repoRootOf } from '../reachable-files';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { partLinkOf } from '../sketch/part-definition';

export const IMPLEMENTS_UNRENDERED_RULE = 'IMPLEMENTS-UNRENDERED';

/**
 * One `IMPLEMENTS-UNRENDERED` problem per part a live page's design embeds whose `implements` host the app renders
 * at none of the slots the design draws it in, on that page part and naming the embedded part's file. A slot the app
 * has no live host for counts as unknown, not as missing.
 */
export const implementsUnrenderedProblemsOf = (options: {
  product: ResolvedProduct;
  states: UncoveredState[];
}): Map<string, Problem[]> => {
  const { product } = options;
  const root = repoRootOf(product);
  const found = new Map<
    string,
    { page: string; part: string; selector: string; rendered: boolean; states: string[] }
  >();

  for (const state of options.states) {
    if ('problem' in state) continue;

    for (const slot of state.slots ?? []) {
      if (slot.rendered === null) continue;

      const key = `${state.page}\0${slot.part}`;
      const entry = found.get(key) ?? {
        page: state.page,
        part: slot.part,
        selector: slot.selector,
        rendered: false,
        states: [],
      };

      entry.rendered ||= slot.rendered;
      if (!entry.states.includes(state.state)) entry.states.push(state.state);
      found.set(key, entry);
    }
  }

  const keys = new Set(product.parts.map(partKeyOf));
  const problems = new Map<string, Problem[]>();

  for (const { page, part, selector, rendered, states } of found.values()) {
    if (rendered) continue;

    const definition = product.parts.find((candidate) => partKeyOf(candidate) === part);

    if (!definition) continue;

    const link = partLinkOf(definition.source);
    const path = link.kind === 'component' ? link.path : link.kind === 'route' ? link.component : null;
    const owner = keys.has(page) ? page : '(product)';

    problems.set(owner, [
      ...(problems.get(owner) ?? []),
      {
        rule: IMPLEMENTS_UNRENDERED_RULE,
        file: relative(root, definition.file),
        at: page,
        message: `${part} implements ${path ?? 'a component'}, but the live page ${page} renders no <${selector}> at its slot in ${states.join(', ')} - link the component the app renders there`,
      },
    ]);
  }

  return problems;
};
