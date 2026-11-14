import { writeFileSync } from 'fs';
import { refreshHarnessMap } from './harness-map';
import { UncoveredState } from './live-uncovered';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { partLinkOf, withLinkOf } from './sketch/part-definition';
import { noteWrite } from './write-journal';

export type DerivedLink = { part: string; from: string | null; to: string };

export type DerivedLinks = { links: DerivedLink[]; ambiguous: { part: string; paths: string[] }[] };

const linkPathOf = (source: string) => {
  const link = partLinkOf(source);

  return link.kind === 'component' ? link.path : link.kind === 'route' ? link.component : null;
};

/**
 * The `implements` link of each embedded part, derived from the app components the live pages render at every slot
 * the design draws the part in. A part whose slots share no component, or that the app draws inline, keeps its link;
 * a page's own component never counts for a part it embeds, nor a component another part links; a foundation gets no
 * link; a part left with more than one candidate is ambiguous.
 */
export const derivedLinksOf = (options: {
  product: ResolvedProduct;
  states: UncoveredState[];
  components: ReadonlyMap<string, string>;
}): DerivedLinks => {
  const { product, components } = options;
  const parts = new Map(product.parts.map((part) => [partKeyOf(part), part]));
  const current = new Map([...parts].map(([key, part]) => [key, linkPathOf(part.source)]));
  const candidates = new Map<string, string[]>();

  for (const state of options.states) {
    if ('problem' in state) continue;

    const page = current.get(state.page) ?? null;

    for (const slot of state.slots ?? []) {
      const paths = slot.selectors
        .map((selector) => components.get(selector))
        .filter((path): path is string => path !== undefined && path !== page);

      const part = parts.get(slot.part);

      if (paths.length === 0 || !part || part.layer === 'foundations') continue;

      const known = candidates.get(slot.part);

      candidates.set(slot.part, known ? known.filter((path) => paths.includes(path)) : paths);
    }
  }

  const settled = new Map<string, string>();

  for (const [part, paths] of candidates) {
    const link = current.get(part);

    if (link && paths.includes(link)) settled.set(part, link);
  }

  for (let changed = true; changed;) {
    changed = false;
    const taken = new Set([...settled.values(), ...[...current.values()].filter((path) => path !== null)]);

    for (const [part, paths] of candidates) {
      if (settled.has(part)) continue;

      const open = paths.filter((path) => !taken.has(path));

      if (open.length === 1 && open[0]) {
        settled.set(part, open[0]);
        changed = true;
      }
    }
  }

  return {
    links: [...settled]
      .filter(([part, path]) => current.get(part) !== path)
      .map(([part, to]) => ({ part, from: current.get(part) ?? null, to }))
      .sort((a, b) => (a.part < b.part ? -1 : 1)),
    ambiguous: [...candidates]
      .filter(([part, paths]) => !settled.has(part) && paths.length > 1)
      .map(([part, paths]) => ({ part, paths })),
  };
};

/**
 * Writes each derived link into its part file and regenerates the harness map from the new links. A part with a
 * route link or one inherited from a base product is left alone. Answers one line per written link, ambiguous part or
 * problem.
 */
export const writeDerivedLinks = (options: { target: string; product: ResolvedProduct; derived: DerivedLinks }) => {
  const lines = options.derived.ambiguous.map(
    ({ part, paths }) =>
      `UNDERIVED ${part}: the live pages draw ${paths.join(' and ')} at its slots, so it keeps its link`,
  );
  const written = new Map<string, string>();

  for (const { part, from, to } of options.derived.links) {
    const resolved = options.product.parts.find((candidate) => partKeyOf(candidate) === part);

    if (!resolved || resolved.origin === 'base' || partLinkOf(resolved.source).kind === 'route') continue;

    const source = withLinkOf(resolved.source, to);

    if (source === null) continue;

    noteWrite(resolved.file);
    writeFileSync(resolved.file, source);
    written.set(part, source);
    lines.push(`LINKED ${part} implements ${to}${from ? ` (was ${from})` : ''}`);
  }

  if (written.size === 0) return lines;

  const refreshed = refreshHarnessMap({
    target: options.target,
    product: {
      ...options.product,
      parts: options.product.parts.map((part) => {
        const source = written.get(partKeyOf(part));

        return source === undefined ? part : { ...part, source };
      }),
    },
  });

  if (typeof refreshed === 'string') lines.push(refreshed);

  return lines;
};
