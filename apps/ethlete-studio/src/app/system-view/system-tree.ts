import { ListedPart, ListedProduct, partFrameUrl, partShotUrl } from '../../host/design';
import { CanvasFrame } from '../components/design-canvas/canvas-frame';

export type SystemGroupKey = 'foundations' | 'components' | 'elements' | 'pages' | 'sketches' | 'legacy';

export const SYSTEM_GROUPS: readonly { key: SystemGroupKey; label: string; layers: readonly string[] }[] = [
  { key: 'foundations', label: 'Foundations', layers: ['foundations'] },
  { key: 'components', label: 'Components', layers: ['components'] },
  { key: 'elements', label: 'Elements', layers: ['elements'] },
  { key: 'pages', label: 'Pages', layers: ['pages'] },
  { key: 'sketches', label: 'Sketches', layers: [] },
  { key: 'legacy', label: 'Legacy', layers: [] },
];

export type PartBadge = 'from base' | 'overridden' | 'error';

export type TreeEntry = { key: string; name: string; badges: PartBadge[] };

export type TreeGroup = { key: SystemGroupKey; label: string; entries: TreeEntry[] };

export const partKeyOf = (part: Pick<ListedPart, 'layer' | 'name'>) => `${part.layer}/${part.name}`;

const badgesOf = (part: ListedPart): PartBadge[] => [
  ...(part.origin === 'base' ? (['from base'] as const) : []),
  ...(part.origin === 'overridden' ? (['overridden'] as const) : []),
  ...(part.problems.length > 0 ? (['error'] as const) : []),
];

/** The groups of the tree that hold a part, each with its entries in listed order. */
export const treeOf = (parts: ListedPart[]): TreeGroup[] =>
  SYSTEM_GROUPS.map(({ key, label, layers }) => ({
    key,
    label,
    entries: parts
      .filter((part) => layers.includes(part.layer))
      .map((part) => ({ key: partKeyOf(part), name: part.name, badges: badgesOf(part) })),
  })).filter((group) => group.entries.length > 0);

export type FramesSource = {
  port: number;
  product: ListedProduct;
  part: ListedPart;
  epoch?: number;
  revision?: number;
  surface?: string;
  color?: string;
};

/** Only a `LOAD` problem fails the frames: a part that breaks a rule still renders, and one that does not load lists no states. */
export const framesOf = ({ port, product, part, epoch, revision, surface, color }: FramesSource): CanvasFrame[] => {
  const key = partKeyOf(part);
  const error =
    part.problems
      .filter((problem) => problem.rule === 'LOAD')
      .map((problem) => problem.message)
      .join('\n') || undefined;
  const rows: (string | undefined)[] = part.states.length > 0 ? part.states : error ? [undefined] : [];

  return rows.flatMap((state) =>
    Object.entries(product.presets).map(([preset, { width, height }]) => {
      const address = { port, product: product.name, part: key, state: state ?? '', epoch, surface, color };

      return {
        id: `${state ?? ''} ${preset}`,
        src: partFrameUrl(address),
        width,
        height,
        label: preset,
        row: state,
        screenshot: partShotUrl({ ...address, preset, revision }),
        error,
      };
    }),
  );
};
