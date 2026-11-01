import { Inventory, InventoryControl, InventoryRefusal } from '../../host/design-inventory';
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

export const canApprove = (inventory: Inventory) =>
  inventory.state.state !== 'approved' &&
  inventory.findings === 0 &&
  !inventoryControlsOf(inventory).some(
    (control) => control.status === 'undeclared' || control.status === 'unclassified',
  );

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

  return message;
};

export const frameLabelOf = (frame: { state: string; preset: string | null; width: number | null }) =>
  [frame.state, frame.preset ?? (frame.width === null ? null : `${frame.width}px`)].filter(Boolean).join(' · ');
