import { ColorThemeType } from '@ethlete/core';
import {
  Inventory,
  InventoryBox,
  InventoryControl,
  InventoryRefusal,
  InventoryStatus,
} from '../../host/design-inventory';

/** The author Studio writes for its user, as in a sketch verdict. */
export const INVENTORY_APPROVER = 'designer';

/** `null` keeps the default (brand, green) theme. */
export const INVENTORY_TONES: Record<InventoryStatus, ColorThemeType | null> = {
  declared: null,
  owned: null,
  undeclared: 'error',
  unclassified: 'warning',
};

/** Every control once, by its number, from all rest frames. */
export const inventoryControlsOf = (inventory: Inventory): InventoryControl[] => {
  const byNumber = new Map<number, InventoryControl>();

  for (const frame of inventory.frames) {
    for (const control of frame.controls) if (!byNumber.has(control.number)) byNumber.set(control.number, control);
  }

  return [...byNumber.values()].sort((a, b) => a.number - b.number);
};

/** Why the approve button is off, or `null` when the inventory can be approved. */
export const approveBlockOf = (inventory: Inventory): string | null => {
  const open = inventoryControlsOf(inventory).filter(
    (control) => control.status === 'undeclared' || control.status === 'unclassified',
  ).length;

  if (open > 0 || inventory.findings > 0)
    return `${Math.max(open, inventory.findings)} control(s) are undeclared or unclassified`;
  if (inventory.state.state === 'approved') return 'already approved';

  return null;
};

const dateOf = (at: string) => {
  const date = new Date(at);

  return Number.isNaN(date.getTime()) ? at : date.toLocaleString();
};

export const approvalLabelOf = (inventory: Inventory) => {
  const { state, approval } = inventory;

  if (state.state === 'none') return 'Not approved yet';
  if (state.state === 'approved') return approval ? `Approved by ${approval.by} on ${dateOf(approval.at)}` : 'Approved';

  const changes = [
    state.added.length ? `added ${state.added.join(', ')}` : '',
    state.removed.length ? `removed ${state.removed.join(', ')}` : '',
    state.changed ? 'the part changed' : '',
  ].filter(Boolean);

  return `Reopened: ${changes.join('; ') || 'the approval no longer holds'}`;
};

export const refusalMessageOf = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  if (error instanceof InventoryRefusal && error.status === 409)
    return `The page changed since this inventory was drawn. Reload it and check it again. (${message})`;
  if (error instanceof InventoryRefusal && error.status === 422)
    return `Declare or classify every red and amber control first. (${message})`;

  return message;
};

/** Places a box over a picture shown at any size, in percent of the shot's own pixels. */
export const boxStyleOf = (box: InventoryBox, shot: { width: number; height: number }) => ({
  left: `${(box.x / shot.width) * 100}%`,
  top: `${(box.y / shot.height) * 100}%`,
  width: `${(box.width / shot.width) * 100}%`,
  height: `${(box.height / shot.height) * 100}%`,
});

export const frameLabelOf = (frame: { state: string; preset: string | null; width: number | null }) =>
  [frame.state, frame.preset ?? (frame.width === null ? null : `${frame.width}px`)].filter(Boolean).join(' · ');
