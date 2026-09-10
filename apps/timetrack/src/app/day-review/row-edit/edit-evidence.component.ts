import {
  Component,
  Directive,
  Injector,
  ViewEncapsulation,
  WritableSignal,
  computed,
  inject,
  input,
} from '@angular/core';
import { Appointment, injectSchedulerEditSurfaceHost } from '@ethlete/components';
import { formatClockTime } from '../format';
import { rowEntryOf } from './row-appointment';

/** Why the row exists: every observation behind it, oldest first. Read-only — evidence is not edited. */
@Component({
  selector: 'ethlete-edit-evidence',
  template: `
    <div class="flex flex-col gap-2">
      <h3 class="text-small text-et-surface-muted">Evidence</h3>

      @if (evidence().length) {
        <ul class="flex max-h-60 flex-col gap-1 overflow-y-auto">
          @for (entry of evidence(); track $index) {
            <li class="flex gap-3 text-small">
              <span class="w-14 shrink-0 text-mono text-et-surface-subtle">{{ entry.time }}</span>
              <span class="w-24 shrink-0 text-et-surface-muted">{{ entry.kind }}</span>
              <span class="grow break-all">{{ entry.detail }}</span>
            </li>
          }
        </ul>
      } @else {
        <p class="text-small text-et-surface-subtle">Nothing is attached to this row.</p>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class EditEvidenceComponent {
  public draft = input.required<WritableSignal<Appointment>>();

  protected evidence = computed(
    () =>
      rowEntryOf(this.draft()())?.row.evidence.map((entry) => ({ ...entry, time: formatClockTime(entry.at) })) ?? [],
  );
}

@Directive({ selector: '[ethleteEditEvidence]' })
export class EditEvidenceDirective {
  private host = injectSchedulerEditSurfaceHost('ethleteEditEvidence');

  constructor() {
    this.host.registerEditField({ component: EditEvidenceComponent, injector: inject(Injector), order: 50 });
  }
}
