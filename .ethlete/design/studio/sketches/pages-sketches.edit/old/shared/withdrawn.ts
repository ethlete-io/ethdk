import { html } from '@design-system';
import { type Row, type RowKey } from '@shared/sketch-rows';
import { SYSTEM_TREE_LABELS } from '../../../../../../../apps/ethlete-studio/src/app/i18n/system-labels';

export type Withdrawn = 'hidden' | 'shown' | 'menu';

const WITHDRAWN: { key: RowKey; reason: string } = {
  key: 'b',
  reason: 'Halbfett macht die Anzahl breiter, der Stepper springt bei zweistelligen Mengen um 4 px',
};

export const isWithdrawn = (row: Row, withdrawn?: Withdrawn) => withdrawn !== undefined && row.key === WITHDRAWN.key;

export const visibleRows = (rows: Row[], withdrawn?: Withdrawn) =>
  withdrawn === 'hidden' || withdrawn === 'menu' ? rows.filter((row) => !isWithdrawn(row, withdrawn)) : rows;

export const withdrawnCount = (rows: Row[], withdrawn?: Withdrawn) =>
  withdrawn === undefined ? 0 : rows.filter((row) => isWithdrawn(row, withdrawn)).length;

export const withdrawnMark = html`<span
  class="text-(length:--sk-note) leading-[1.35] text-et-surface-muted italic wrap-anywhere"
  data-sk-withdrawn
  >${SYSTEM_TREE_LABELS.withdrawnLabel}: ${WITHDRAWN.reason}</span
>`;
