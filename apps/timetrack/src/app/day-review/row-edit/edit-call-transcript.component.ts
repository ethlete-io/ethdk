import { Component, ViewEncapsulation, WritableSignal, computed, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Appointment } from '@ethlete/components';
import { CALL_LANE_KEY } from '@ethlete/timetrack';
import { catchError, of, switchMap } from 'rxjs';
import { injectHostPorts } from '../../../host';
import { callTranscriptOf$ } from '../call-transcript';
import { injectDayReview } from '../day-review';
import { rowEntryOf, TimelineEntry } from './row-appointment';

/** What the transcriber heard of the call a call row was built from, shown with its evidence. */
@Component({
  selector: 'ethlete-edit-call-transcript',
  template: `
    @if (transcript(); as text) {
      <div class="flex flex-col gap-1 text-small" data-call-transcript>
        <span class="text-et-surface-muted">Call transcript, raw machine text of your microphone</span>
        <span class="min-w-0 break-words">{{ text }}</span>
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
})
export class EditCallTranscriptComponent {
  private ports = injectHostPorts();
  private store = injectDayReview();

  public draft = input.required<WritableSignal<Appointment<TimelineEntry>>>();

  private callRow = computed(() => {
    const row = rowEntryOf(this.draft()())?.row;

    return row?.laneKey === CALL_LANE_KEY ? row : null;
  });

  protected transcript = toSignal(
    toObservable(this.callRow).pipe(
      switchMap((row) =>
        row
          ? callTranscriptOf$({ ports: this.ports, row, calls: this.store.deterministic()?.calls ?? [] }).pipe(
              catchError(() => of(undefined)),
            )
          : of(undefined),
      ),
    ),
    { initialValue: undefined },
  );
}
