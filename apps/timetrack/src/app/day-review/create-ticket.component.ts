import { Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import {
  BANNER_IMPORTS,
  BUTTON_IMPORTS,
  FORM_FIELD_IMPORTS,
  INPUT_IMPORTS,
  SpinnerComponent,
  TEXTAREA_IMPORTS,
} from '@ethlete/components';
import { ParentCandidate, UnnamedContext, describeAttributionRule, formatDurationMs } from '@ethlete/timetrack';
import { TicketForm } from './ticket-draft';

/**
 * The create form for work no issue covers. It writes to Jira, so it shows the whole ticket before it
 * is sent and keeps every field editable: a wrong row can be edited away, a wrong ticket cannot.
 */
@Component({
  selector: 'ethlete-create-ticket',
  template: `
    <div class="flex flex-col gap-3 rounded-md border border-et-brand-ink p-3">
      <div class="flex flex-wrap items-baseline gap-3">
        <h4 class="grow text-h4">New ticket for {{ label() }}</h4>
        <span class="text-small text-et-surface-muted">{{ duration() }}</span>
        <button (click)="dismiss.emit()" et-button variant="transparent" size="sm">Close</button>
      </div>

      @if (createdKey(); as key) {
        <et-banner
          [description]="key + ' now holds this work, here and on every later day this context appears in.'"
          type="success"
          heading="Filed"
        />
      } @else if (form(); as draft) {
        @if (createFailure(); as failure) {
          <et-banner [description]="failure" type="error" heading="Jira did not take the ticket" />
        }

        <div class="flex flex-wrap items-end gap-3">
          <et-form-field class="w-30" appearance="underline" size="sm">
            <et-label>Project</et-label>
            <et-input
              [value]="draft.projectKey"
              (valueChange)="projectKeyChange.emit($event)"
              (blur)="findParents.emit()"
              placeholder="FIP"
            />
          </et-form-field>

          <et-form-field class="min-w-60 grow" appearance="underline" size="sm">
            <et-label>Summary</et-label>
            <et-input [value]="draft.summary" (valueChange)="summaryChange.emit($event)" />
          </et-form-field>
        </div>

        <et-form-field appearance="underline" size="sm">
          <et-label>Description</et-label>
          <et-textarea
            [value]="draft.description"
            [minRows]="3"
            [maxRows]="10"
            (valueChange)="descriptionChange.emit($event)"
            autosize
          />
        </et-form-field>

        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-3">
            <span class="text-small">Parent</span>
            @if (isSearching()) {
              <et-spinner size="sm" />
            }
          </div>

          @if (searchFailure(); as failure) {
            <et-banner [description]="failure" type="warning" heading="The parents could not be read" />
          }

          <div class="flex max-h-60 flex-col gap-1 overflow-y-auto">
            <button
              [attr.aria-pressed]="!draft.parentKey"
              (click)="parentKeyChange.emit(null)"
              et-button
              variant="transparent"
              size="sm"
            >
              No parent
            </button>

            @for (candidate of candidates(); track candidate.issue.key) {
              <button
                [attr.aria-pressed]="draft.parentKey === candidate.issue.key"
                [variant]="draft.parentKey === candidate.issue.key ? 'filled' : 'transparent'"
                (click)="parentKeyChange.emit(candidate.issue.key)"
                et-button
                size="sm"
              >
                {{ candidate.issue.key }} — {{ candidate.issue.summary }}
              </button>
            }
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button
            [disabled]="!canCreate() || isCreating()"
            (click)="create.emit()"
            et-button
            variant="filled"
            size="sm"
          >
            @if (isCreating()) {
              <et-spinner size="sm" />
            }
            Create in Jira
          </button>

          <span class="text-small text-et-surface-muted">
            Filing it also logs this work against the new key from now on.
          </span>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BANNER_IMPORTS, BUTTON_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS, SpinnerComponent, TEXTAREA_IMPORTS],
})
export class CreateTicketComponent {
  public context = input.required<UnnamedContext>();
  public form = input<TicketForm | null>(null);
  public candidates = input<readonly ParentCandidate[]>([]);
  public isSearching = input(false);
  public isCreating = input(false);
  public canCreate = input(false);
  public createdKey = input<string | null>(null);
  public searchFailure = input<string | null>(null);
  public createFailure = input<string | null>(null);

  public projectKeyChange = output<string>();
  public summaryChange = output<string>();
  public descriptionChange = output<string>();
  public parentKeyChange = output<string | null>();
  public findParents = output<void>();
  public create = output<void>();
  public dismiss = output<void>();

  protected label = computed(() => describeAttributionRule(this.context().suggestion));
  protected duration = computed(() => formatDurationMs(this.context().observedMs));
}
