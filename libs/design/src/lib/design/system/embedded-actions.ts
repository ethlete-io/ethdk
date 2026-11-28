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

/** The hash of the app component files `part` links, `null` when it links no component. */
export const appHashOf = (options: { product: ResolvedProduct; part: ResolvedPart }): string | null => {
  const link = partLinkOf(options.part.source);
  const component = link.kind === 'component' ? link.path : link.kind === 'route' ? link.component : null;

  return component === null ? null : hashOfFiles(appFilesOf({ root: repoRootOf(options.product), component }));
};

/** The app hash of each part `part` embeds that links a component, sorted by part key. */
export const embeddedHashesOf = (options: { product: ResolvedProduct; part: ResolvedPart }): EmbeddedHashes =>
  Object.fromEntries(
    embeddedPartsOf(options)
      .flatMap((embedded) => {
        const hash = appHashOf({ product: options.product, part: embedded });

        return hash === null ? [] : [[partKeyOf(embedded), hash] as const];
      })
      .sort(([a], [b]) => a.localeCompare(b)),
  );

/** The embedded parts whose app files moved, appeared or went away between two embedded hash records, sorted. */
export const changedEmbeddedOf = (before: EmbeddedHashes, now: EmbeddedHashes) =>
  [...new Set([...Object.keys(before), ...Object.keys(now)])]
    .filter((part) => before[part] !== now[part])
    .sort((a, b) => a.localeCompare(b));

/** Why the actions of `part` run again, from the parts whose app files changed: `part` itself or embedded ones. */
export const actionsRerunReasonOf = (changed: string[], part?: string) => {
  const embedded = changed.filter((key) => key !== part);
  const moved = [
    ...(embedded.length < changed.length ? ['its app files'] : []),
    ...(embedded.length > 0 ? [`embedded ${embedded.join(', ')}`] : []),
  ];

  return `${moved.join(' and ')} changed since its actions last ran`;
};

export const actionsRerunLineOf = (options: { product: string; part: string; embedded: string[] }) =>
  `ACTIONS RERUN ${options.product} ${options.part}: ${actionsRerunReasonOf(options.embedded, options.part)} - run et design ready ${options.part} again`;
