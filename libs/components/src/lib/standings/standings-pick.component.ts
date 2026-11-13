import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  Component,
  DestroyRef,
  computed,
  ElementRef,
  inject,
  linkedSignal,
  signal,
  ViewEncapsulation,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  DragHandleDirective,
  DragMoveEvent,
  injectObserveMediaQuery,
  mountEasingTokens,
  mountVisuallyHidden,
} from '@ethlete/core';
import { filter, tap, timer } from 'rxjs';
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

/** How far the lifted card may travel before it would leave the viewport and grow the page's scroll area. */
type LiftBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

type DragState = {
  from: number;
  to: number;
  liftX: number;
  liftY: number;
  offsets: readonly number[];
  bounds: LiftBounds;
  settling: boolean;
};

const SETTLE_TIMEOUT_MS = 1000;

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
 * The whole card is the drag target, and each row carries **one** control for ArrowUp / ArrowDown, so
 * the order can be arranged without a pointer. Focus stays on the row it was on while the row moves
 * under it.
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

  private destroyRef = inject(DestroyRef);

  private prefersReducedMotion = injectObserveMediaQuery('(prefers-reduced-motion: reduce)');

  private document = inject(DOCUMENT);

  private rowElements = viewChildren<ElementRef<HTMLElement>>('rowElement');

  private cardElements = viewChildren<ElementRef<HTMLElement>>('cardElement');

  /** Reset whenever `locked` changes: locking removes the handle mid-drag, and a removed handle never ends its drag. */
  private dragState = linkedSignal<boolean, DragState | null>({
    source: this.pick.locked,
    computation: () => null,
  });

  protected labels = computed(() => this.pick.resolvedLabels());

  protected announcement = signal('');

  protected isDragging = computed(() => !!this.dragState());

  protected draggingIndex = computed(() => this.dragState()?.from ?? -1);

  protected isSettling = computed(() => !!this.dragState()?.settling);

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
      if (index === state.from) return `${state.liftX}px ${state.liftY}px`;

      const offset = state.offsets[index] ?? 0;

      return offset ? `0 ${offset}px` : null;
    });
  });

  constructor() {
    mountVisuallyHidden();
    mountEasingTokens();
  }

  protected startDrag(index: number) {
    if (this.pick.locked() || this.dragState()) return;

    this.dragState.set({
      from: index,
      to: index,
      liftX: 0,
      liftY: 0,
      offsets: [],
      bounds: this.liftBounds(index),
      settling: false,
    });
  }

  protected previewDrop(event: Pick<DragMoveEvent, 'clientY' | 'totalDx' | 'totalDy'>) {
    const state = this.dragState();

    if (!state || state.settling) return;

    const slots = this.slots();
    const to = slotAt(slots, event.clientY);

    this.dragState.set({
      ...state,
      to,
      liftX: Math.min(Math.max(event.totalDx, state.bounds.minX), state.bounds.maxX),
      liftY: Math.min(Math.max(event.totalDy, state.bounds.minY), state.bounds.maxY),
      offsets: previewOffsets(slots, { from: state.from, to }),
    });
  }

  /** Slides the released card into the slot it was dropped on, then commits once it got there. */
  protected settleDrop() {
    const state = this.dragState();

    if (!state || state.settling) return;

    const offsets = state.offsets.length ? state.offsets : previewOffsets(this.slots(), state);
    const landingY = offsets[state.from] ?? 0;

    if (this.prefersReducedMotion() || (Math.abs(state.liftX) < 0.5 && Math.abs(state.liftY - landingY) < 0.5)) {
      this.commitDrop();

      return;
    }

    const settling: DragState = { ...state, liftX: 0, liftY: landingY, offsets, settling: true };

    this.dragState.set(settling);

    timer(SETTLE_TIMEOUT_MS)
      .pipe(
        filter(() => this.dragState() === settling),
        tap(() => this.commitDrop()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected finishSettle(event: TransitionEvent, index: number) {
    if (event.target !== event.currentTarget || event.propertyName !== 'translate') return;
    if (index !== this.draggingIndex() || !this.isSettling()) return;

    this.commitDrop();
  }

  /** The browser took the gesture away, so there is no position the user chose - slide back. */
  protected abandonDrag() {
    this.dragState.set(null);
  }

  protected moveByKey(event: Event, move: StandingsPickMove) {
    event.preventDefault();

    if (!this.pick.move(move)) return;

    const row = this.pick.rows()[move.to];

    if (!row) return;

    this.announcement.set(
      this.labels().pickMoved(
        matchParticipantDisplayName({ participant: row.participant, labels: this.matchLabels() }),
        row.position,
      ),
    );
  }

  /**
   * Commit and drop the preview in one change, so the reordered list renders straight into the positions
   * the preview already put the cards in - clearing them a tick later flashes the old order.
   */
  private commitDrop() {
    const state = this.dragState();

    this.dragState.set(null);

    if (state) this.pick.move({ from: state.from, to: state.to });
  }

  private liftBounds(index: number): LiftBounds {
    const rect = this.cardElements()[index]?.nativeElement.getBoundingClientRect();
    const { clientWidth, clientHeight } = this.document.documentElement;

    if (!rect) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };

    return {
      minX: Math.min(0, -rect.left),
      maxX: Math.max(0, clientWidth - rect.right),
      minY: Math.min(0, -rect.top),
      maxY: Math.max(0, clientHeight - rect.bottom),
    };
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
