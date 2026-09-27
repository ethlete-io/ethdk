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
        <ul class="flex flex-col gap-2">
          @for (entry of shown(); track $index) {
            <li class="flex flex-col text-small">
              <span class="flex gap-2 text-et-surface-muted">
                <span class="text-mono text-et-surface-subtle">{{ entry.time }}</span>
                <span>{{ entry.kindLabel }}</span>
              </span>
              <span class="min-w-0 break-words">
                @for (part of entry.parts; track $index) {
                  @if (part.code) {
                    <code class="text-mono">{{ part.text }}</code>
                  } @else {
                    {{ part.text }}
                  }
                }
              </span>
            </li>
          }
        </ul>

        @if (hiddenCount()) {
          <button (click)="expanded.set(true)" class="self-start" et-text-button type="button">
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
      rowEntryOf(this.draft()())?.row.evidence.map((entry) => ({
        ...entry,
        time: formatClockTime(entry.at),
        kindLabel: entry.kind.replaceAll('-', ' '),
        parts: entry.detail.split('`').map((text, index) => ({ text, code: index % 2 === 1 })),
      })) ?? [],
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
