import {
  Component,
  Directive,
  Injector,
  ViewEncapsulation,
  WritableSignal,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Appointment, BUTTON_IMPORTS, injectSchedulerEditSurfaceHost } from '@ethlete/components';
import { formatClockTime } from '../format';
import { rowEntryOf } from './row-appointment';

const COLLAPSED_EVIDENCE_COUNT = 3;

/** Why the row exists: every observation behind it, oldest first. Read-only — evidence is not edited. */
@Component({
  selector: 'ethlete-edit-evidence',
  template: `
    <div class="flex flex-col gap-2">
      <h3 class="text-small text-et-surface-muted">Evidence</h3>

      @if (evidence().length) {
        <ul class="flex flex-col gap-1">
          @for (entry of shown(); track $index) {
            <li class="flex gap-3 text-small">
              <span class="w-20 shrink-0 whitespace-nowrap text-mono text-et-surface-subtle">{{ entry.time }}</span>
              <span class="w-24 shrink-0 text-et-surface-muted">{{ entry.kind }}</span>
              <span class="min-w-0 grow break-words">{{ entry.detail }}</span>
            </li>
          }
        </ul>

        @if (hiddenCount()) {
          <button
            (click)="expanded.set(true)"
            class="self-start"
            et-button
            size="sm"
            type="button"
            variant="transparent"
          >
            Show all {{ evidence().length }}
          </button>
        }
      } @else {
        <p class="text-small text-et-surface-subtle">Nothing is attached to this row.</p>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class EditEvidenceComponent {
  public draft = input.required<WritableSignal<Appointment>>();

  protected evidence = computed(
    () =>
      rowEntryOf(this.draft()())?.row.evidence.map((entry) => ({ ...entry, time: formatClockTime(entry.at) })) ?? [],
  );

  protected expanded = signal(false);

  protected shown = computed(() =>
    this.expanded() ? this.evidence() : this.evidence().slice(0, COLLAPSED_EVIDENCE_COUNT),
  );

  protected hiddenCount = computed(() => this.evidence().length - this.shown().length);
}

@Directive({ selector: '[ethleteEditEvidence]' })
export class EditEvidenceDirective {
  private host = injectSchedulerEditSurfaceHost('ethleteEditEvidence');

  constructor() {
    this.host.registerEditField({ component: EditEvidenceComponent, injector: inject(Injector), order: 50 });
  }
}
