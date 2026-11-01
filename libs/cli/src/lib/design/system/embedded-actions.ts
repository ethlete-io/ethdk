import { appFilesOf } from './app-files';
import { hashOfFiles } from './design-hash';
import { reachableFilesOf, repoRootOf } from './reachable-files';
import { partKeyOf, ResolvedPart, ResolvedProduct } from './resolve-product';
import { partLinkOf } from './sketch/part-definition';

/** The hash of each embedded part's app component files, under the part key. */
export type EmbeddedHashes = Record<string, string>;

/** The parts `part` embeds through its imports, directly or through another part, itself excluded. */
export const embeddedPartsOf = (options: { product: ResolvedProduct; part: ResolvedPart }) => {
  const { product, part } = options;
  const reached = reachableFilesOf(product, [part]).files;

  return product.parts.filter((candidate) => candidate !== part && reached.has(candidate.file));
};

/** The app hash of each part `part` embeds that links a component, sorted by part key. */
export const embeddedHashesOf = (options: { product: ResolvedProduct; part: ResolvedPart }): EmbeddedHashes => {
  const root = repoRootOf(options.product);

  return Object.fromEntries(
    embeddedPartsOf(options)
      .flatMap((embedded) => {
        const link = partLinkOf(embedded.source);
        const component = link.kind === 'component' ? link.path : link.kind === 'route' ? link.component : null;

        return component === null ? [] : [[partKeyOf(embedded), hashOfFiles(appFilesOf({ root, component }))] as const];
      })
      .sort(([a], [b]) => a.localeCompare(b)),
  );
};

/** The embedded parts whose app files moved, appeared or went away between two embedded hash records, sorted. */
export const changedEmbeddedOf = (before: EmbeddedHashes, now: EmbeddedHashes) =>
  [...new Set([...Object.keys(before), ...Object.keys(now)])]
    .filter((part) => before[part] !== now[part])
    .sort((a, b) => a.localeCompare(b));

export const actionsRerunReasonOf = (embedded: string[]) =>
  `embedded ${embedded.join(', ')} changed since its actions last ran`;

export const actionsRerunLineOf = (options: { product: string; part: string; embedded: string[] }) =>
  `ACTIONS RERUN ${options.product} ${options.part}: ${actionsRerunReasonOf(options.embedded)} - run et design ready ${options.part} again`;
