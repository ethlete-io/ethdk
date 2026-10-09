import { Component, ViewEncapsulation, WritableSignal, computed, input } from '@angular/core';
import { Appointment } from '@ethlete/components';
import { rowEntryOf, TimelineEntry } from './row-appointment';

/** Marks a description auto mode wrote, while the draft still holds it. */
@Component({
  selector: 'ethlete-edit-description-source',
  template: `
    @if (writtenByAutoMode()) {
      <span class="text-small text-et-surface-muted" data-auto-described>
        Written by auto mode. Reset to the proposal takes it back.
      </span>
    }
  `,
  encapsulation: ViewEncapsulation.None,
})
export class EditDescriptionSourceComponent {
  public draft = input.required<WritableSignal<Appointment<TimelineEntry>>>();

  protected writtenByAutoMode = computed(() => {
    const draft = this.draft()();
    const row = rowEntryOf(draft)?.row;

    return row?.sources?.description === 'auto' && (draft.description ?? '') === row.description;
  });
}
