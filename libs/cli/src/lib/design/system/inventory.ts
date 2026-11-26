import { SHOT_PATH } from '../shot';
import { Browser } from '../thumb';
import {
  declaredControlsOf,
  findingKeyOf,
  FoundControl,
  FoundItem,
  FrameAddress,
  FrameBox,
  inventoryIdsOf,
  isFindingOf,
  SeenFrame,
  seePart,
} from './complete';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { SystemModules } from './system-modules';

/**
 * `declared` is marked and declared; `owned` is drawn by the embedded part `owner`, which declares it; `undeclared`
 * (red) is a control without a declaration; `unclassified` (amber) only looks interactive.
 */
export type InventoryStatus = 'declared' | 'owned' | 'undeclared' | 'unclassified';

/**
 * One numbered control in a rest frame. A control keeps its number in every frame that draws it. `covered` is set
 * when another element is on top at its centre and all four corners.
 */
export type InventoryControl = {
  number: number;
  id: string;
  label: string | null;
  status: InventoryStatus;
  kind: string;
  inputs: string[];
  surfaces: string[];
  owner: string | null;
  states: number;
  box: FrameBox | null;
  covered: boolean;
};

/**
 * An inline SVG, an image or an open overlay of a rest frame. `owned` is drawn by the embedded part `owner`
 * (`foundations/<name>` for an asset, `components/<part>` for an overlay); `finding` has no owner: an inline asset or
 * a mocked overlay. `number` counts per kind within the frame, top to bottom.
 */
export type InventoryItem = {
  number: number;
  kind: 'asset' | 'overlay';
  status: 'owned' | 'finding';
  what: string;
  id: string;
  label: string | null;
  owner: string | null;
  box: FrameBox | null;
  covered: boolean;
};

/** A rest frame of a page, the URL of its picture, the controls and the assets and overlays it draws, in its pixels. */
export type InventoryFrame = FrameAddress & { shot: string; controls: InventoryControl[]; items: InventoryItem[] };

/** The control inventory of a page and its part hash. `dir` holds the part. */
export type Inventory = {
  part: string;
  dir: string;
  hash: string;
  ids: string[];
  findings: number;
  frames: InventoryFrame[];
};

const shotOf = (options: { product: string; part: string; address: FrameAddress }) => {
  const { product, part, address } = options;
  const search = new URLSearchParams({ product, part, state: address.state });

  if (address.preset !== null) search.set('preset', address.preset);
  else if (address.width !== null) search.set('width', String(address.width));

  return `${SHOT_PATH}?${search.toString()}`;
};

const isOpen = (status: InventoryStatus) => status === 'undeclared' || status === 'unclassified';

const byPlace = (a: { box: FrameBox | null }, b: { box: FrameBox | null }) =>
  (a.box?.y ?? Infinity) - (b.box?.y ?? Infinity) || (a.box?.x ?? Infinity) - (b.box?.x ?? Infinity);

/** A control an embedded part draws that no marked control of the frame already stands for. */
const isOwnedOf = (frame: SeenFrame) => (found: FoundControl) =>
  found.kind === 'control' &&
  (found.owner ?? null) !== null &&
  !found.within.some((id) => frame.controls.some((control) => control.id === id));

const itemsOf = (items: FoundItem[]): InventoryItem[] => {
  const counts = { asset: 0, overlay: 0 };

  return items
    .map((item) => ({ item, box: item.box ?? null }))
    .sort(byPlace)
    .map(({ item }) => ({
      number: ++counts[item.kind],
      kind: item.kind,
      status: item.owner === null ? ('finding' as const) : ('owned' as const),
      what: item.what,
      id: item.path,
      label: item.label ?? null,
      owner: item.owner,
      box: item.box ?? null,
      covered: item.covered ?? false,
    }));
};

/** Numbers the declared, owned, undeclared and unclassified controls each rest frame draws, top to bottom. */
export const inventoryFramesOf = (options: {
  product: string;
  part: string;
  controls: unknown;
  frames: SeenFrame[];
  addresses: FrameAddress[];
}): InventoryFrame[] => {
  const { product, part, frames, addresses } = options;
  const declared = declaredControlsOf(options.controls) ?? {};
  const isFinding = isFindingOf(declared);
  const rest = frames.filter((frame) => frame.interaction === null);
  const drawn = rest.map((frame) =>
    [
      ...frame.controls.map((control) => {
        const known = declared[control.id];

        const marked = (frame.found ?? []).find((found) => found.marked === control.id && found.label);

        return {
          key: `declared ${control.id}`,
          id: control.id,
          label: marked?.label ?? null,
          status: known ? ('declared' as const) : ('undeclared' as const),
          kind: known?.kind ?? '',
          inputs: known?.input ?? [],
          surfaces: Object.keys(known?.surfaces ?? {}),
          owner: null,
          box: control.box ?? null,
          covered: control.covered ?? false,
        };
      }),
      ...(frame.found ?? []).filter(isOwnedOf(frame)).map((found) => ({
        key: `owned ${found.owner} ${found.path} ${found.label ?? ''}`,
        id: found.path,
        label: found.label ?? null,
        status: 'owned' as const,
        kind: found.what,
        inputs: [],
        surfaces: [],
        owner: found.owner ?? null,
        box: found.box ?? null,
        covered: found.covered ?? false,
      })),
      ...(frame.found ?? []).filter(isFinding).map((found) => ({
        key: findingKeyOf(found),
        id: found.path,
        label: found.label ?? null,
        status: found.kind === 'control' ? ('undeclared' as const) : ('unclassified' as const),
        kind: found.what,
        inputs: [],
        surfaces: [],
        owner: null,
        box: found.box ?? null,
        covered: found.covered ?? false,
      })),
    ].sort(byPlace),
  );
  const numbers = new Map<string, number>();
  const counts = new Map<string, number>();

  for (const controls of drawn) {
    for (const { key } of controls) if (!numbers.has(key)) numbers.set(key, numbers.size + 1);
    for (const key of new Set(controls.map((control) => control.key))) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return rest.flatMap((frame, index) => {
    const address = addresses.find((candidate) => candidate.state === frame.state);

    return address
      ? [
          {
            ...address,
            shot: shotOf({ product, part, address }),
            controls: (drawn[index] ?? []).map(({ key, ...control }) => ({
              ...control,
              number: numbers.get(key) ?? 0,
              states: counts.get(key) ?? 0,
            })),
            items: itemsOf(frame.items ?? []),
          },
        ]
      : [];
  });
};

/** Draws the rest frames of a page and answers its control inventory, or why it cannot. */
export const inventoryOf = async (options: {
  product: ResolvedProduct;
  part: string;
  system: SystemModules;
  base: string;
  load: (id: string) => Promise<unknown>;
  draw: <T>(job: (browser: Browser) => Promise<T>) => Promise<T>;
}): Promise<Inventory | string> => {
  const { product, part } = options;
  const resolved = product.parts.find((candidate) => partKeyOf(candidate) === part);

  if (!resolved) return `product "${product.name}" has no part "${part}"`;
  if (resolved.layer !== 'pages') return `${part} is no page - only a page has a control inventory`;

  const sight = await seePart({ ...options, part: resolved, restOnly: true });

  if (typeof sight === 'string') return sight.split('\n')[0] ?? '';
  if (sight.refused.length > 0) return sight.refused.join('; ');

  const frames = inventoryFramesOf({
    product: product.name,
    part,
    controls: sight.definition?.controls,
    frames: sight.seen,
    addresses: sight.addresses,
  });
  const ids = inventoryIdsOf(sight.seen);
  const findings =
    new Set(
      frames.flatMap((frame) =>
        frame.controls.filter((control) => isOpen(control.status)).map((control) => control.number),
      ),
    ).size +
    new Set(
      frames.flatMap((frame) =>
        frame.items.filter((item) => item.status === 'finding').map((item) => `${item.kind} ${item.id} ${item.label}`),
      ),
    ).size;

  return {
    part,
    hash: sight.hash,
    ids,
    findings,
    frames,
    dir: sight.owner.dir,
  };
};
