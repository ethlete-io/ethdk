import { Directive, computed, inject } from '@angular/core';
import { OVERLAY_REF, OverlayRef, injectSchedulerEditSurfaceHost } from '@ethlete/components';
import { injectDayReview } from '../day-review';
import { rowEntryOf } from './row-appointment';
import { ROW_ACTIONS, RowActionContext } from './row-actions';

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

  private context = computed<RowActionContext | null>(() => {
    const row = rowEntryOf(this.host.appointment())?.row ?? null;

    return row ? { store: this.store, row, rows: this.store.rows() } : null;
  });

  constructor() {
    for (const action of ROW_ACTIONS) {
      this.host.registerAppointmentAction({
        label: computed(() => action.label),
        order: action.order,
        destructive: action.destructive,
        enabled: computed(() => {
          const context = this.context();

          return !!context && action.enabled(context);
        }),
        run: () => {
          const context = this.context();

          if (!context) return;

          action.run(context);
          this.overlayRef?.close();
        },
      });
    }
  }
}
