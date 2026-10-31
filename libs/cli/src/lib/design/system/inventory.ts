import { SHOT_PATH } from '../shot';
import { Browser } from '../thumb';
import {
  declaredControlsOf,
  findingKeyOf,
  FoundControl,
  FrameAddress,
  FrameBox,
  inventoryIdsOf,
  isFindingOf,
  SeenFrame,
  seePart,
} from './complete';
import {
  InventoryApproval,
  inventoryReasonOf,
  InventoryState,
  inventoryStateOf,
  readInventory,
  writeInventoryApproval,
} from './inventory-approval';
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

/** A rest frame of a page, the URL of its picture and the controls it draws, in its pixels. */
export type InventoryFrame = FrameAddress & { shot: string; controls: InventoryControl[] };

/** The control inventory of a page, its part hash, and whether its approval holds. `dir` holds its inventory.json. */
export type Inventory = {
  part: string;
  dir: string;
  hash: string;
  ids: string[];
  findings: number;
  approval: InventoryApproval | null;
  state: InventoryState;
  reason: string | null;
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

        return {
          key: `declared ${control.id}`,
          id: control.id,
          label: null,
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
          },
        ]
      : [];
  });
};

/** Draws the rest frames of a page and answers its control inventory and approval state, or why it cannot. */
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
  const approval = readInventory(sight.owner.dir)[part] ?? null;
  const state = inventoryStateOf({ approval: approval ?? undefined, ids, hash: sight.hash });
  const findings = new Set(
    frames.flatMap((frame) =>
      frame.controls.filter((control) => isOpen(control.status)).map((control) => control.number),
    ),
  ).size;

  return {
    part,
    hash: sight.hash,
    ids,
    findings,
    approval,
    state,
    reason: inventoryReasonOf(state),
    frames,
    dir: sight.owner.dir,
  };
};

/**
 * Records the user's approval of the inventory Studio showed, or answers why it is refused: `hash` is the part hash
 * that inventory had, and a page with an undeclared or unclassified control cannot be approved.
 */
export const approveInventory = (options: {
  inventory: Inventory;
  hash: unknown;
  by: unknown;
  at?: string;
}): { status: number; error: string } | InventoryApproval => {
  const { inventory, hash, by } = options;

  if (typeof by !== 'string' || by.trim() === '') return { status: 400, error: 'by is required' };
  if (typeof hash !== 'string' || hash === '') return { status: 400, error: 'hash is required' };
  if (inventory.findings > 0)
    return {
      status: 422,
      error: `${inventory.part} has ${inventory.findings} undeclared or unclassified control(s) - declare them before approving`,
    };
  if (hash !== inventory.hash)
    return {
      status: 409,
      error: `${inventory.part} changed since its inventory was shown - reload and check it again`,
    };

  const approval: InventoryApproval = {
    ids: inventory.ids,
    hash,
    by: by.trim(),
    at: options.at ?? new Date().toISOString(),
  };

  writeInventoryApproval({ productDir: inventory.dir, part: inventory.part, approval });

  return approval;
};
