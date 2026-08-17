import { Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import { FORM_FIELD_IMPORTS, RADIO_GROUP_IMPORTS, SELECT_IMPORTS } from '@ethlete/components';
import { TimetrackTicketSettings } from '@ethlete/timetrack';
import { injectJiraCatalog } from '../jira';
import { ExplainComponent } from './explain.component';

const WHY = `Work the day found that no issue covers can be filed from the review. These say what to file
it as, and every one of them is instance-specific.

Jira's default hierarchy puts Story and Task on the same level, so whether "a Task under a Story" is even
expressible through the parent field depends on the levels your instance defines. Read the hierarchy in
Jira before changing the level a ticket is filed at — a ticket at the wrong level is harder to explain
than no ticket at all.`;

const SUBJECT_WHY = `A branch is named from the ticket, and the part after the key is the subject:
feat/ABC-2177-user-management carries user-management. Naming the field that holds it lets a ticket filed
here be turned into a branch name, and lets a branch be traced back to its ticket.

It is a custom field, and its id differs on every instance — which is why this is a list of your own
fields rather than a box to type an id into. Leave it unset to write no subject.`;

/**
 * How this instance wants a ticket filed.
 *
 * Every value here was a text field once, and every one of them was a value nobody could check: an issue
 * type spelled in the instance's own language, a link type that has to match a name in Jira exactly, a
 * custom field id. All four are now read from the instance, so a wrong one is not typeable.
 */
@Component({
  selector: 'ethlete-ticket-settings',
  template: `
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-1">
        <h3 class="text-h4">New tickets</h3>
        <ethlete-explain [text]="WHY" label="new tickets" />
      </div>

      <div class="flex flex-wrap gap-3">
        <et-form-field class="w-45" appearance="underline" size="sm">
          <et-label>File as</et-label>
          <et-select
            [value]="settings().issueTypeName || null"
            [loading]="catalog.isLoadingIssueTypes()"
            [error]="catalog.issueTypeFailure()"
            (valueChange)="setIssueTypeName($event)"
            (openChange)="openedTypes($event)"
            placeholder="Pick a type"
            allowCustomValues
          >
            <input etSelectSearch placeholder="Search types" />

            @for (type of types(); track type) {
              <et-select-option [value]="type">{{ type }}</et-select-option>
            }
          </et-select>
        </et-form-field>

        <et-form-field class="min-w-60 grow" appearance="underline" size="sm">
          <et-label>A parent may be</et-label>
          <et-select
            [value]="settings().parentIssueTypeNames"
            [loading]="catalog.isLoadingIssueTypes()"
            (valueChange)="setParentIssueTypeNames($event)"
            (openChange)="openedTypes($event)"
            placeholder="Any open issue in the project"
            multiple
            allowCustomValues
          >
            <input etSelectSearch placeholder="Search types" />

            @for (type of types(); track type) {
              <et-select-option [value]="type">{{ type }}</et-select-option>
            }
          </et-select>
          <et-hint>Empty offers every open issue in the project.</et-hint>
        </et-form-field>
      </div>

      <et-radio-group [value]="settings().parenting" (valueChange)="setParenting($event)" orientation="horizontal">
        <et-label>A parent is named by</et-label>
        <et-radio value="parent-field">the parent field</et-radio>
        <et-radio value="issue-link">an issue link</et-radio>
      </et-radio-group>

      <div class="flex flex-wrap items-end gap-3">
        @if (settings().parenting === 'issue-link') {
          <et-form-field class="w-45" appearance="underline" size="sm">
            <et-label>Link type</et-label>
            <et-select
              [value]="settings().parentLinkType || null"
              (valueChange)="setParentLinkType($event)"
              placeholder="Relates"
              allowCustomValues
            >
              <input etSelectSearch placeholder="Search link types" />

              @for (type of LINK_TYPES; track type) {
                <et-select-option [value]="type">{{ type }}</et-select-option>
              }
            </et-select>
          </et-form-field>
        }

        <et-form-field class="min-w-60 grow" appearance="underline" size="sm">
          <et-label>Branch-subject field</et-label>
          <et-select
            [value]="settings().subjectField || null"
            [loading]="catalog.isLoadingFields()"
            [error]="catalog.fieldFailure()"
            (valueChange)="setSubjectField($event)"
            (openChange)="openedFields($event)"
            placeholder="Write no subject"
          >
            <input etSelectSearch placeholder="Search your fields" />

            @for (field of subjectFields(); track field.id) {
              <et-select-option [value]="field.id" [label]="field.name + ' ' + field.id">
                <span class="flex min-w-0 items-baseline gap-2">
                  <span class="min-w-0 grow truncate text-small">{{ field.name }}</span>
                  <span class="shrink-0 text-mono text-small text-et-surface-subtle">{{ field.id }}</span>
                </span>
              </et-select-option>
            }
          </et-select>
        </et-form-field>

        <ethlete-explain [text]="SUBJECT_WHY" label="the branch-subject field" />
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ExplainComponent, FORM_FIELD_IMPORTS, RADIO_GROUP_IMPORTS, SELECT_IMPORTS],
})
export class TicketSettingsComponent {
  protected catalog = injectJiraCatalog();
  public settings = input.required<TimetrackTicketSettings>();

  public settingsChange = output<TimetrackTicketSettings>();
  protected readonly WHY = WHY;
  protected readonly SUBJECT_WHY = SUBJECT_WHY;

  /** Jira's own built-in link types. The instance may define more, so the field still takes a name. */
  protected readonly LINK_TYPES = ['Relates', 'Blocks', 'Cloners', 'Duplicate'];

  /** The type names, most specific level first, so the level a ticket is filed at reads top to bottom. */
  protected types = computed(() => [
    ...new Set(
      [...this.catalog.issueTypes()]
        .sort((a, b) => b.hierarchyLevel - a.hierarchyLevel || a.name.localeCompare(b.name))
        .map((type) => type.name),
    ),
  ]);

  protected subjectFields = computed(() => this.catalog.subjectFields());

  protected openedTypes(open: boolean) {
    if (open) this.catalog.loadIssueTypes();
  }

  protected openedFields(open: boolean) {
    if (open) this.catalog.loadFields();
  }

  protected setIssueTypeName(value: unknown) {
    this.emit({ issueTypeName: typeof value === 'string' ? value.trim() : '' });
  }

  protected setParentIssueTypeNames(value: unknown) {
    const names = Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

    this.emit({ parentIssueTypeNames: [...new Set(names.map((name) => name.trim()).filter(Boolean))] });
  }

  protected setParenting(parenting: unknown) {
    this.emit({ parenting: parenting === 'issue-link' ? 'issue-link' : 'parent-field' });
  }

  protected setParentLinkType(value: unknown) {
    this.emit({ parentLinkType: typeof value === 'string' ? value.trim() : '' });
  }

  protected setSubjectField(value: unknown) {
    this.emit({ subjectField: typeof value === 'string' ? value.trim() : '' });
  }

  private emit(change: Partial<TimetrackTicketSettings>) {
    this.settingsChange.emit({ ...this.settings(), ...change });
  }
}
