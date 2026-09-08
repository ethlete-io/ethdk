import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, ElementRef, inject, signal, ViewEncapsulation, viewChildren } from '@angular/core';
import { DragHandleDirective, DragMoveEvent } from '@ethlete/core';
import { FocusRingDirective } from '../focus-ring';
import { injectMatchLabels, MATCH_PARTICIPANT_IMPORTS, matchParticipantDisplayName } from '../match';
import { StandingsPickDirective, StandingsPickMarkContext, StandingsPickMove } from './headless';

/** A row's resting slot, measured from the layout the preview transforms never touch. */
type PickSlot = {
  top: number;
  mid: number;
};

const slotAt = (slots: readonly PickSlot[], clientY: number) =>
  Math.min(slots.filter((slot) => clientY > slot.mid).length, Math.max(slots.length - 1, 0));

/**
 * How far each row has to shift to sit where the move would leave it.
 *
 * Every row is mapped onto a **measured** slot rather than onto a sum of row heights, so the cut line
 * between two of them is accounted for and any permutation lands exactly on a real slot.
 */
const previewOffsets = (slots: readonly PickSlot[], move: { from: number; to: number }) => {
  const landing = slots.map((_, index) => index);
  const [moved] = landing.splice(move.from, 1);

  if (moved !== undefined) landing.splice(move.to, 0, moved);

  const offsets = slots.map(() => 0);

  landing.forEach((restingIndex, slot) => {
    offsets[restingIndex] = (slots[slot]?.top ?? 0) - (slots[restingIndex]?.top ?? 0);
  });

  return offsets;
};

/**
 * A group table a viewer predicts the order of: the participants as a list of cards, reorderable by drag
 * and by keyboard, with the advancing cut drawn where the qualifying places end. Driven by the headless
 * {@link StandingsPickDirective}.
 *
 * Every row carries **one** control, and it does both: it is the drag grip and the target for ArrowUp /
 * ArrowDown, so the order can be arranged without a pointer. Focus stays on the row it was on while the
 * row moves under it.
 *
 * The row's trailing slot is the app's - fill it with `ng-template[etStandingsPickMark]` to show what a
 * pick scored. Whether a pick was right is the app's data, so this component models no points.
 *
 * @example
 * <et-standings-pick [(order)]="order" [participants]="teams()" [advancingCount]="2" />
 *
 * @example
 * <!-- once the group is over -->
 * <et-standings-pick [participants]="teams()" [storedPicks]="picks()" [advancingCount]="2" locked>
 *   <ng-template let-row etStandingsPickMark>{{ pointsOf(row.participant.id) }}</ng-template>
 * </et-standings-pick>
 */
@Component({
  selector: 'et-standings-pick',
  templateUrl: './standings-pick.component.html',
  styleUrl: './standings-pick.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [MATCH_PARTICIPANT_IMPORTS, NgTemplateOutlet, DragHandleDirective, FocusRingDirective],
  hostDirectives: [
    {
      directive: StandingsPickDirective,
      inputs: ['participants', 'storedPicks', 'advancingCount', 'locked', 'order', 'labels'],
      outputs: ['orderChange'],
    },
  ],
  host: {
    class: 'et-standings-pick',
  },
})
export class StandingsPickComponent {
  protected pick = inject(StandingsPickDirective);

  private matchLabels = injectMatchLabels();

  private rowElements = viewChildren<ElementRef<HTMLElement>>('rowElement');

  private dragState = signal<{ from: number; to: number; liftY: number; offsets: readonly number[] } | null>(null);

  protected labels = computed(() => this.pick.resolvedLabels());

  protected isDragging = computed(() => !!this.dragState());

  protected draggingIndex = computed(() => this.dragState()?.from ?? -1);

  protected renderRows = computed(() => {
    const labels = this.labels();
    const matchLabels = this.matchLabels();

    return this.pick.rows().map((row, index) => ({
      row,
      markContext: { $implicit: row, index } satisfies StandingsPickMarkContext,
      moveLabel: labels.pickMoveRow(matchParticipantDisplayName({ participant: row.participant, labels: matchLabels })),
    }));
  });

  protected translates = computed<(string | null)[]>(() => {
    const state = this.dragState();

    if (!state) return [];

    return this.pick.rows().map((_, index) => {
      if (index === state.from) return `0 ${state.liftY}px`;

      const offset = state.offsets[index] ?? 0;

      return offset ? `0 ${offset}px` : null;
    });
  });

  protected startDrag(index: number) {
    if (this.pick.locked()) return;

    this.dragState.set({ from: index, to: index, liftY: 0, offsets: [] });
  }

  protected previewDrop(event: DragMoveEvent) {
    const state = this.dragState();

    if (!state) return;

    const slots = this.slots();
    const to = slotAt(slots, event.clientY);

    this.dragState.set({
      from: state.from,
      to,
      liftY: event.totalDy,
      offsets: previewOffsets(slots, { from: state.from, to }),
    });
  }

  /**
   * Commit and drop the preview in one change, so the reordered list renders straight into the positions
   * the preview already put the cards in - clearing them a tick later flashes the old order.
   */
  protected commitDrop() {
    const state = this.dragState();

    this.dragState.set(null);

    if (state) this.pick.move({ from: state.from, to: state.to });
  }

  /** The browser took the gesture away, so there is no position the user chose - slide back. */
  protected abandonDrag() {
    this.dragState.set(null);
  }

  protected moveByKey(event: Event, move: StandingsPickMove) {
    event.preventDefault();
    this.pick.move(move);
  }

  /**
   * The rows' resting slots. Read live off the row wrappers, which the preview never transforms - only the
   * cards inside them move - so each pointer position maps to one slot however far the preview has slid.
   */
  private slots(): PickSlot[] {
    return this.rowElements().map((ref) => {
      const rect = ref.nativeElement.getBoundingClientRect();

      return { top: rect.top, mid: rect.top + rect.height / 2 };
    });
  }
}
