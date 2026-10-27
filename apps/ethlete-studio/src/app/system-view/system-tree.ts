import {
  ListedCall,
  ListedPart,
  ListedProduct,
  callShotUrl,
  frameUrl,
  partFrameUrl,
  partShotUrl,
} from '../../host/design';
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

export type PartBadge = 'from base' | 'overridden' | 'error' | 'transferred';

export type TreeEntry = { key: string; name: string; title?: string; badges: PartBadge[] };

export type TreeSection = { key: string; label: string; entries: TreeEntry[] };

export type TreeGroup = { key: string; label: string; entries: TreeEntry[]; sections?: TreeSection[] };

export const partKeyOf = (part: Pick<ListedPart, 'layer' | 'name'>) => `${part.layer}/${part.name}`;

const badgesOf = (part: ListedPart): PartBadge[] => [
  ...(part.origin === 'base' ? (['from base'] as const) : []),
  ...(part.origin === 'overridden' ? (['overridden'] as const) : []),
  ...(part.problems.length > 0 ? (['error'] as const) : []),
];

export const callKeyOf = (slug: string) => `legacy:${slug}`;

const callBadgesOf = (call: ListedCall): PartBadge[] =>
  'error' in call ? ['error'] : call.transferred ? ['transferred'] : [];

const callEntryOf = (call: ListedCall, name: string): TreeEntry => ({
  key: callKeyOf(call.slug),
  name,
  title: 'error' in call ? call.error : call.headline,
  badges: callBadgesOf(call),
});

/** One Legacy group for all calls, or one per project once the calls span several. Calls sharing a stage (the first slug segment after the project) form a section. */
export const legacyGroupsOf = (calls: ListedCall[]): TreeGroup[] => {
  const projects = [...new Set(calls.map((call) => call.project))];
  const split = projects.length > 1;

  return projects.map((project) => {
    const groupKey = split ? `legacy/${project}` : 'legacy';
    const entries: TreeEntry[] = [];
    const sections = new Map<string, TreeSection>();

    for (const call of calls.filter((listed) => listed.project === project)) {
      const rest = call.slug.slice(project.length + 1) || call.slug;
      const slash = rest.indexOf('/');

      if (slash <= 0) {
        entries.push(callEntryOf(call, rest));
        continue;
      }

      const stage = rest.slice(0, slash);
      const section = sections.get(stage) ?? { key: `${groupKey}/${stage}`, label: stage, entries: [] };

      section.entries.push(callEntryOf(call, rest.slice(slash + 1)));
      sections.set(stage, section);
    }

    return {
      key: groupKey,
      label: split ? `Legacy · ${project}` : 'Legacy',
      entries,
      sections: [...sections.values()],
    };
  });
};

export type OpenContext = { remembered: Record<string, boolean>; hasProducts: boolean };

/** The keys of the group and the section that hold the entry, outermost first. */
export const holdersOf = (tree: TreeGroup[], key: string | null): string[] => {
  if (key === null) return [];

  for (const group of tree) {
    if (group.entries.some((entry) => entry.key === key)) return [group.key];

    const section = group.sections?.find((candidate) => candidate.entries.some((entry) => entry.key === key));

    if (section) return [group.key, section.key];
  }

  return [];
};

/** Whether a group shows its entries: the remembered choice, else open - except Legacy beside products. */
export const isGroupOpen = (group: TreeGroup, { remembered, hasProducts }: OpenContext) =>
  remembered[group.key] ?? (group.key.startsWith('legacy') ? !hasProducts : true);

/** Whether a section shows its entries: the remembered choice, else folded. */
export const isSectionOpen = (section: TreeSection, { remembered }: OpenContext) => remembered[section.key] ?? false;

/** The groups of the tree that hold a part or a call, each with its entries in listed order. */
export const treeOf = (parts: ListedPart[], calls: ListedCall[] = []): TreeGroup[] =>
  SYSTEM_GROUPS.flatMap(({ key, label, layers }) =>
    key === 'legacy'
      ? legacyGroupsOf(calls)
      : [
          {
            key,
            label,
            entries: parts
              .filter((part) => layers.includes(part.layer))
              .map((part) => ({ key: partKeyOf(part), name: part.name, badges: badgesOf(part) })),
          },
        ],
  ).filter((group) => group.entries.length > 0 || (group.sections?.length ?? 0) > 0);

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

/** The width a call frame takes when its call declares none. */
export const DEFAULT_CALL_WIDTH = 1280;

export type CallFramesSource = {
  port: number;
  call: ListedCall;
  epoch?: number;
  revision?: number;
  surface?: string;
  color?: string;
};

/** One frame per variant of a legacy call, at the call's own frame width. A call that does not load gets one failed frame. */
export const callFramesOf = ({ port, call, epoch, revision, surface, color }: CallFramesSource): CanvasFrame[] => {
  if ('error' in call) {
    return [{ id: call.slug, src: 'about:blank', width: DEFAULT_CALL_WIDTH, label: call.slug, error: call.error }];
  }

  const width = call.frameWidth > 0 ? call.frameWidth : DEFAULT_CALL_WIDTH;

  return call.variants.map((variant) => {
    const address = { port, slug: call.slug, variant: variant.key, epoch, surface, color };

    return {
      id: variant.key,
      src: frameUrl(address),
      width,
      label: variant.name || variant.key,
      screenshot: callShotUrl({ ...address, width, revision }),
    };
  });
};
