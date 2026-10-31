import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { formattedTextOf } from './prettier';
import { ResolvedPart, ResolvedProduct } from './resolve-product';

export const INVENTORY_FILE = 'inventory.json';

/** The control ids of a page and its part hash, as the user approved them in Studio. */
export type InventoryApproval = { ids: string[]; hash: string; by: string; at: string };

/** Whether the approved inventory of a page still holds: its ids and hash match, it reopened, or it never was approved. */
export type InventoryState =
  | { state: 'approved' }
  | { state: 'reopened'; added: string[]; removed: string[]; changed: boolean }
  | { state: 'none' };

const inventoryFileOf = (productDir: string) => resolve(productDir, INVENTORY_FILE);

const isApproval = (value: unknown): value is InventoryApproval => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const { ids, hash, by, at } = value as Record<string, unknown>;

  return (
    Array.isArray(ids) &&
    ids.every((id) => typeof id === 'string') &&
    typeof hash === 'string' &&
    typeof by === 'string' &&
    typeof at === 'string'
  );
};

/** The directory whose merged.json and inventory.json hold a part: its base's for a part the product takes from its base. */
export const partOwnerOf = (options: { product: ResolvedProduct; part: ResolvedPart }) =>
  options.part.origin === 'base' && options.product.base
    ? { dir: options.product.base.dir, base: null }
    : options.product;

export const readInventory = (productDir: string): Record<string, InventoryApproval> => {
  const file = inventoryFileOf(productDir);

  if (!existsSync(file)) return {};

  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? Object.fromEntries(
          Object.entries(parsed).filter((entry): entry is [string, InventoryApproval] => isApproval(entry[1])),
        )
      : {};
  } catch {
    return {};
  }
};

export const writeInventoryApproval = (options: { productDir: string; part: string; approval: InventoryApproval }) => {
  const { productDir, part, approval } = options;
  const approvals = { ...readInventory(productDir), [part]: { ...approval, ids: [...approval.ids].sort() } };
  const sorted = Object.fromEntries(Object.entries(approvals).sort(([a], [b]) => a.localeCompare(b)));

  const file = inventoryFileOf(productDir);
  const text = `${JSON.stringify(sorted, null, 2)}\n`;
  const formatted = formattedTextOf({ target: productDir, file, text });

  writeFileSync(file, typeof formatted === 'string' ? formatted : text);
};

export const inventoryStateOf = (options: {
  approval: InventoryApproval | undefined;
  ids: string[];
  hash: string;
}): InventoryState => {
  const { approval, ids, hash } = options;

  if (!approval) return { state: 'none' };

  const added = ids.filter((id) => !approval.ids.includes(id)).sort();
  const removed = approval.ids.filter((id) => !ids.includes(id)).sort();
  const changed = approval.hash !== hash;

  return added.length > 0 || removed.length > 0 || changed
    ? { state: 'reopened', added, removed, changed }
    : { state: 'approved' };
};

/** Why a page's inventory is not approved, for a gap line or Studio, or `null` when it is. */
export const inventoryReasonOf = (state: InventoryState) => {
  if (state.state === 'approved') return null;
  if (state.state === 'none') return 'its control inventory is not approved';

  const reasons = [
    ...(state.added.length > 0 ? [`added ${state.added.join(', ')}`] : []),
    ...(state.removed.length > 0 ? [`removed ${state.removed.join(', ')}`] : []),
    ...(state.changed ? ['the part changed'] : []),
  ];

  return `its approved control inventory reopened: ${reasons.join('; ')}`;
};
