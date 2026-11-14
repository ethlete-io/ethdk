import { writeFileSync } from 'fs';
import { refreshHarnessMap } from './harness-map';
import { UncoveredState } from './live-uncovered';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { partLinkOf, withLinkOf, withRouteComponentOf } from './sketch/part-definition';
import { noteWrite } from './write-journal';

export type DerivedLink = { part: string; from: string | null; to: string };

export type DerivedLinks = { links: DerivedLink[]; ambiguous: { part: string; paths: string[] }[] };

const linkPathOf = (source: string) => {
  const link = partLinkOf(source);

  return link.kind === 'component' ? link.path : link.kind === 'route' ? link.component : null;
};

const pageLinksOf = (options: {
  parts: ReadonlyMap<string, ResolvedProduct['parts'][number]>;
  states: UncoveredState[];
  components: ReadonlyMap<string, string>;
  current: ReadonlyMap<string, string | null>;
  takes: (page: string, path: string) => boolean;
}) => {
  const around = new Map<string, string[]>();

  for (const state of options.states) {
    if ('problem' in state || !state.around) continue;

    const paths = state.around
      .map((selector) => options.components.get(selector))
      .filter((path): path is string => path !== undefined);
    const known = around.get(state.page);

    around.set(state.page, known ? known.filter((path) => paths.includes(path)) : paths);
  }

  return [...around].flatMap(([page, paths]): [string, string][] => {
    const part = options.parts.get(page);

    if (!part || part.layer !== 'pages' || partLinkOf(part.source).kind !== 'route') return [];

    const taken = new Set([...options.current].filter(([key]) => key !== page).map(([, path]) => path));
    const innermost = paths.find((path) => !taken.has(path) && options.takes(page, path));

    return innermost ? [[page, innermost]] : [];
  });
};

/**
 * The `implements` link of each embedded part, derived from the app components the live pages render at every slot
 * the design draws the part in. A part whose slots share no component, or that the app draws inline, keeps its link;
 * a page's own component never counts for a part it embeds, nor a component another part links; a foundation gets no
 * link; a part left with more than one candidate is ambiguous. A page with a route link gets the innermost app component at
 * or around its live host in every state of it that `takes` every design prop of the page, skipping the shared host, the
 * shell and components other parts link; without `takes` no page link is derived.
 */
export const derivedLinksOf = (options: {
  product: ResolvedProduct;
  states: UncoveredState[];
  components: ReadonlyMap<string, string>;
  takes?: (page: string, path: string) => boolean;
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

  for (const [page, path] of pageLinksOf({
    parts,
    states: options.states,
    components,
    current,
    takes: options.takes ?? (() => false),
  }))
    settled.set(page, path);

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
 * Writes each derived link into its part file and regenerates the harness map from the new links; a route link keeps
 * its route. A part inherited from a base product is left alone. Answers one line per written link, ambiguous part or
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

    if (!resolved || resolved.origin === 'base') continue;

    const source =
      partLinkOf(resolved.source).kind === 'route'
        ? withRouteComponentOf(resolved.source, to)
        : withLinkOf(resolved.source, to);

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
