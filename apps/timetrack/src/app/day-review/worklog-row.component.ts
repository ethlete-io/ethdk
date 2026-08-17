import { Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import {
  BADGE_IMPORTS,
  BUTTON_IMPORTS,
  CHECKBOX_IMPORTS,
  CHEVRON_ICON,
  DURATION_INPUT_IMPORTS,
  FORM_FIELD_IMPORTS,
  ICON_IMPORTS,
  INPUT_IMPORTS,
  provideIcons,
} from '@ethlete/components';
import { Confidence, ReviewedRow, formatDurationMs, isManualRow, syncsInState } from '@ethlete/timetrack';
import { IssueSelectComponent } from '../jira';
import { formatClockTime } from './format';

const CONFIDENCE_TONE: Record<Confidence, string> = {
  certain: 'text-et-success-ink',
  likely: 'text-et-surface-muted',
  weak: 'text-et-warning-ink',
};

/**
 * One reviewable worklog: its issue, duration and description editable in place, its confidence and
 * its evidence chain on show. A weak row is dashed and unchecked, because the machine is guessing and
 * the reviewer has to say so before it syncs.
 */
@Component({
  selector: 'ethlete-worklog-row',
  template: `
    <div
      [attr.data-weak]="row().confidence === 'weak'"
      [attr.data-rejected]="row().state === 'rejected'"
      class="rounded-md border border-et-surface-border p-3 data-[rejected=true]:opacity-55 data-[weak=true]:border-dashed"
    >
      <div class="flex flex-wrap items-center gap-3">
        <et-checkbox
          [checked]="willSync()"
          [attr.aria-label]="'Log time for ' + row().issueKey"
          (checkedChange)="stateChange.emit($event ? 'accepted' : 'rejected')"
        />

        <ethlete-issue-select
          [value]="row().issueKey"
          [ariaLabel]="'Issue for ' + row().issueKey"
          (valueChange)="issueChange.emit($event)"
          class="w-42 shrink-0"
        />

        @if (manual()) {
          <et-badge size="sm" color="brand">by hand</et-badge>
        }

        <et-form-field class="w-22 shrink-0" appearance="underline" size="sm">
          <et-duration-input
            [value]="row().durationMs"
            [aria-label]="'Duration for ' + row().issueKey"
            (valueChange)="durationChange.emit($event ?? 0)"
            durationFormat="hh:mm"
          />
        </et-form-field>

        <et-form-field class="min-w-50 grow" appearance="underline" size="sm">
          <et-input
            [value]="row().description"
            [aria-label]="'Description for ' + row().issueKey"
            (valueChange)="descriptionChange.emit($event)"
          />
        </et-form-field>

        <span [class]="tone()" class="text-small">{{ row().confidence }}</span>

        @if (row().edited) {
          <et-badge size="sm">edited</et-badge>
        }

        @if (synced()) {
          <et-badge size="sm" color="brand">in Tempo</et-badge>
        }

        <button [attr.aria-pressed]="selected()" (click)="mergeToggle.emit()" et-button variant="outline" size="sm">
          {{ selected() ? 'Selected' : 'Select' }}
        </button>

        <button
          [attr.aria-expanded]="expanded()"
          [attr.aria-label]="'Evidence for ' + row().issueKey"
          (click)="expandToggle.emit()"
          et-button
          variant="transparent"
          size="sm"
        >
          <i [class.rotate-180]="!expanded()" class="transition-transform" etIcon="et-chevron"></i>
        </button>
      </div>

      @if (expanded()) {
        <div class="mt-3 flex flex-col gap-3 border-t border-et-surface-border pt-3">
          <p class="text-small text-et-surface-muted">
            {{ clock() }} · observed {{ observed() }}, logging {{ logged() }}
          </p>

          @if (evidence().length) {
            <ul class="flex flex-col gap-1">
              @for (entry of evidence(); track $index) {
                <li class="flex gap-3 text-small">
                  <span class="w-14 shrink-0 text-mono text-et-surface-subtle">{{ entry.time }}</span>
                  <span class="w-28 shrink-0 text-et-surface-muted">{{ entry.kind }}</span>
                  <span class="grow break-all">{{ entry.detail }}</span>
                </li>
              }
            </ul>
          } @else {
            <p class="text-small text-et-surface-subtle">No evidence is attached to this row.</p>
          }

          <div class="flex flex-wrap gap-2">
            <button (click)="split.emit()" et-button variant="outline" size="sm">Split in half</button>

            @if (manual()) {
              <button (click)="removeRow.emit()" et-button variant="transparent" size="sm">Remove this row</button>
            } @else if (row().edited) {
              <button (click)="revert.emit()" et-button variant="transparent" size="sm">Reset to proposal</button>
            }
          </div>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BADGE_IMPORTS,
    BUTTON_IMPORTS,
    CHECKBOX_IMPORTS,
    DURATION_INPUT_IMPORTS,
    FORM_FIELD_IMPORTS,
    ICON_IMPORTS,
    INPUT_IMPORTS,
    IssueSelectComponent,
  ],
  providers: [provideIcons(CHEVRON_ICON)],
})
export class WorklogRowComponent {
  public row = input.required<ReviewedRow>();
  public expanded = input(false);
  public selected = input(false);
  public synced = input(false);

  public issueChange = output<string>();
  public descriptionChange = output<string>();
  public durationChange = output<number>();
  public stateChange = output<'accepted' | 'rejected'>();
  public expandToggle = output<void>();
  public mergeToggle = output<void>();
  public split = output<void>();
  public revert = output<void>();
  /** Takes a hand-written row off the day. Only such a row can be removed — see `removeManualRow`. */
  public removeRow = output<void>();

  protected willSync = computed(() => syncsInState(this.row().state));
  protected manual = computed(() => isManualRow(this.row()));
  protected tone = computed(() => CONFIDENCE_TONE[this.row().confidence]);
  protected observed = computed(() => formatDurationMs(this.row().observedMs));
  protected logged = computed(() => formatDurationMs(this.row().durationMs));
  protected clock = computed(() => `${formatClockTime(this.row().from)} – ${formatClockTime(this.row().to)}`);

  protected evidence = computed(() =>
    this.row().evidence.map((entry) => ({ ...entry, time: formatClockTime(entry.at) })),
  );
}
