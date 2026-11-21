import { DesignRefusalError } from '../../host/design';
import { Inventory, InventoryControl, InventoryItem, InventoryRefusal } from '../../host/design-inventory';
import {
  InventoryPageEntry,
  InventoryPageRow,
  InventoryPageTone,
} from '../design-parts/inventory-page/inventory-page.component';
import { STUDIO_LABELS } from '../i18n/studio-labels';

const LABELS = STUDIO_LABELS.inventory;

/** The author Studio writes for its user, as in a sketch verdict. */
export const INVENTORY_APPROVER = 'designer';

/** Every control once, by its number, from all rest frames; it is covered only when every frame covers it. */
export const inventoryControlsOf = (inventory: Inventory): InventoryControl[] => {
  const byNumber = new Map<number, InventoryControl>();

  for (const frame of inventory.frames) {
    for (const control of frame.controls) {
      const known = byNumber.get(control.number);

      if (!known) byNumber.set(control.number, control);
      else if (known.covered && !control.covered) byNumber.set(control.number, { ...known, covered: false });
    }
  }

  return [...byNumber.values()].sort((a, b) => a.number - b.number);
};

export const inventoryItemsOf = (inventory: Inventory): InventoryItem[] => {
  const byKey = new Map<string, InventoryItem>();

  for (const frame of inventory.frames) {
    for (const item of [...frame.items].sort((a, b) => a.number - b.number)) {
      const key = `${item.kind} ${item.id}`;
      const known = byKey.get(key);

      if (!known) byKey.set(key, item);
      else if (known.covered && !item.covered) byKey.set(key, { ...known, covered: false });
    }
  }

  const counts = { asset: 0, overlay: 0 };

  return [...byKey.values()].map((item) => ({ ...item, number: ++counts[item.kind] }));
};

const isOpen = (status: InventoryControl['status']) => status === 'undeclared' || status === 'unclassified';

const toneOf = (status: InventoryControl['status']): InventoryPageTone =>
  status === 'undeclared' ? 'error' : status === 'unclassified' ? 'warning' : 'ok';

const firstFrameBoxOf = (
  inventory: Inventory,
  has: (frame: Inventory['frames'][number]) => { box: InventoryControl['box']; covered: boolean } | undefined,
) => {
  const first = inventory.frames[0];
  const found = first ? has(first) : undefined;

  return found && !found.covered ? found.box : null;
};

export const inventoryPageOf = (
  inventory: Inventory,
  shown: Pick<InventoryPageEntry, 'approvalLabel' | 'size'>,
): InventoryPageEntry => {
  const controls = inventoryControlsOf(inventory);
  const items = inventoryItemsOf(inventory);
  const itemRow = (item: InventoryItem, prefix: string): InventoryPageRow => ({
    number: `${prefix}${item.number}`,
    name: item.label ?? item.what,
    detail: item.owner
      ? LABELS.ownedBy(item.owner)
      : item.kind === 'asset'
        ? LABELS.assetFinding
        : LABELS.overlayFinding,
    tone: item.status === 'finding' ? 'error' : 'ok',
    box: firstFrameBoxOf(inventory, (frame) =>
      frame.items.find((candidate) => candidate.kind === item.kind && candidate.id === item.id),
    ),
  });

  return {
    part: inventory.part,
    approval: inventory.state.state === 'approved' ? 'approved' : canApprove(inventory) ? 'approvable' : 'open',
    approvalLabel: shown.approvalLabel,
    controls: controls.map((control) => ({
      number: String(control.number),
      name: control.label ?? control.id,
      detail: control.owner ? LABELS.ownedBy(control.owner) : LABELS.status[control.status],
      tone: toneOf(control.status),
      box: firstFrameBoxOf(inventory, (frame) =>
        frame.controls.find((candidate) => candidate.number === control.number),
      ),
    })),
    assets: items.filter((item) => item.kind === 'asset').map((item) => itemRow(item, 'A')),
    overlays: items.filter((item) => item.kind === 'overlay').map((item) => itemRow(item, 'O')),
    shot: inventory.frames[0]?.shot ?? null,
    size: shown.size,
  };
};

export const canApprove = (inventory: Inventory) =>
  inventory.state.state !== 'approved' &&
  inventory.findings === 0 &&
  !inventoryControlsOf(inventory).some((control) => isOpen(control.status)) &&
  !inventoryItemsOf(inventory).some((item) => item.status === 'finding');

const dateOf = (at: string) => {
  const date = new Date(at);

  return Number.isNaN(date.getTime()) ? at : date.toLocaleString('de-DE');
};

export const approvalLabelOf = (inventory: Inventory) => {
  const { state, approval } = inventory;

  if (state.state === 'none') return LABELS.notApproved;
  if (state.state === 'approved')
    return approval ? LABELS.approvedByOn(approval.by, dateOf(approval.at)) : LABELS.approved;

  const changes = [
    state.added.length ? LABELS.added(state.added.join(', ')) : '',
    state.removed.length ? LABELS.removed(state.removed.join(', ')) : '',
    state.changed ? LABELS.partChanged : '',
  ].filter(Boolean);

  return LABELS.reopened(changes.join('; ') || LABELS.noLongerHolds);
};

export const refusalMessageOf = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  if (error instanceof InventoryRefusal && error.status === 409) return LABELS.pageChanged(message);
  if (error instanceof InventoryRefusal && error.status === 422) return LABELS.openControls(message);
  if (error instanceof DesignRefusalError) return [message, ...error.findings].join('\n');

  return message;
};
