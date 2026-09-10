import { Directive, computed, inject } from '@angular/core';
import { OVERLAY_REF, OverlayRef, injectSchedulerEditSurfaceHost } from '@ethlete/components';
import { ReviewedRow, isManualRow } from '@ethlete/timetrack';
import { injectDayReview } from '../day-review';
import { rowEntryOf } from './row-appointment';

/**
 * What the surface's own action menu offers a row: the cuts and the undos that are not a field.
 *
 * Each acts on the row as it stands rather than on the draft, and closes the surface: every one of
 * them replaces the row it was opened for, so there is nothing left for a later save to write.
 */
@Directive({ selector: '[ethleteRowActions]' })
export class RowActionsDirective {
  private host = injectSchedulerEditSurfaceHost('ethleteRowActions');
  private store = injectDayReview();
  private overlayRef = inject<OverlayRef>(OVERLAY_REF, { optional: true });

  private row = computed(() => rowEntryOf(this.host.appointment())?.row ?? null);

  /** The band that starts where this one ends. Only such a pair can merge without inventing time. */
  private next = computed(() => {
    const row = this.row();

    if (!row) return null;

    return this.store.rows().find((candidate) => candidate.from.getTime() === row.to.getTime()) ?? null;
  });

  private manual = computed(() => {
    const row = this.row();

    return !!row && isManualRow(row);
  });

  constructor() {
    this.host.registerAppointmentAction({
      label: computed(() => 'Split in half'),
      order: 10,
      enabled: computed(() => !!this.row()),
      run: () => this.act((row) => this.store.split(row, new Date((row.from.getTime() + row.to.getTime()) / 2))),
    });

    this.host.registerAppointmentAction({
      label: computed(() => 'Merge with the next band'),
      order: 20,
      enabled: computed(() => !!this.next()),
      run: () =>
        this.act((row) => {
          const next = this.next();

          if (next) this.store.mergeRows([row, next]);
        }),
    });

    this.host.registerAppointmentAction({
      label: computed(() => 'Reset to the proposal'),
      order: 30,
      enabled: computed(() => !!this.row()?.edited && !this.manual()),
      run: () => this.act((row) => this.store.reset(row)),
    });

    this.host.registerAppointmentAction({
      label: computed(() => 'Hide this row'),
      order: 35,
      enabled: computed(() => !!this.row()),
      run: () => this.act((row) => this.store.hide(row)),
    });

    this.host.registerAppointmentAction({
      label: computed(() => 'Remove this row'),
      order: 40,
      destructive: true,
      enabled: this.manual,
      run: () => this.act((row) => this.store.removeRow(row)),
    });
  }

  private act(run: (row: ReviewedRow) => void) {
    const row = this.row();

    if (!row) return;

    run(row);
    this.overlayRef?.close();
  }
}
