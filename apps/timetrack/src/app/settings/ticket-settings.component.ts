import { Component, ViewEncapsulation, input, linkedSignal, output } from '@angular/core';
import { FORM_FIELD_IMPORTS, INPUT_IMPORTS, RADIO_GROUP_IMPORTS } from '@ethlete/components';
import { TimetrackTicketSettings } from '@ethlete/timetrack';

/**
 * How this instance wants a ticket filed. Every value here is instance-specific: Jira's default
 * hierarchy puts Story and Task on the same level, and the field holding a branch subject is a custom
 * field with a different id on every instance, so none of it can be worked out from the outside.
 */
@Component({
  selector: 'ethlete-ticket-settings',
  template: `
    <div class="flex flex-col gap-3">
      <h3 class="text-h4">New tickets</h3>

      <p class="text-small text-et-surface-muted">
        Work the day found that no issue covers can be filed from the review. These say what to file it as. Read your
        instance's own hierarchy in Jira before changing them — a ticket at the wrong level is harder to explain than no
        ticket at all.
      </p>

      <div class="flex flex-wrap gap-3">
        <et-form-field class="w-40" appearance="underline" size="sm">
          <et-label>File as</et-label>
          <et-input [value]="settings().issueTypeName" (valueChange)="setIssueTypeName($event)" placeholder="Task" />
        </et-form-field>

        <et-form-field class="min-w-60 grow" appearance="underline" size="sm">
          <et-label>A parent may be</et-label>
          <et-input [(value)]="typedParentTypes" (blur)="commitParentTypes()" placeholder="Story, Epic" />
          <et-hint>Leave empty to offer every open issue in the project.</et-hint>
        </et-form-field>
      </div>

      <et-radio-group [value]="settings().parenting" (valueChange)="setParenting($event)" orientation="horizontal">
        <et-label>A parent is named by</et-label>
        <et-radio value="parent-field">the parent field</et-radio>
        <et-radio value="issue-link">an issue link</et-radio>
      </et-radio-group>

      <div class="flex flex-wrap gap-3">
        @if (settings().parenting === 'issue-link') {
          <et-form-field class="w-40" appearance="underline" size="sm">
            <et-label>Link type</et-label>
            <et-input
              [value]="settings().parentLinkType"
              (valueChange)="setParentLinkType($event)"
              placeholder="Relates"
            />
          </et-form-field>
        }

        <et-form-field class="min-w-60 grow" appearance="underline" size="sm">
          <et-label>Branch-subject field</et-label>
          <et-input
            [value]="settings().subjectField"
            (valueChange)="setSubjectField($event)"
            placeholder="customfield_10057"
          />
          <et-hint>
            The field holding user-management in feat/FIP-2177-user-management, as the id the API writes to. Empty
            writes no subject.
          </et-hint>
        </et-form-field>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, INPUT_IMPORTS, RADIO_GROUP_IMPORTS],
})
export class TicketSettingsComponent {
  public settings = input.required<TimetrackTicketSettings>();

  public settingsChange = output<TimetrackTicketSettings>();

  /** Held as typed until the field is left, or normalising each keystroke would eat the separator. */
  protected typedParentTypes = linkedSignal(() => this.settings().parentIssueTypeNames.join(', '));

  protected setIssueTypeName(issueTypeName: string) {
    this.emit({ issueTypeName: issueTypeName.trim() });
  }

  protected setParenting(parenting: unknown) {
    this.emit({ parenting: parenting === 'issue-link' ? 'issue-link' : 'parent-field' });
  }

  protected setParentLinkType(parentLinkType: string) {
    this.emit({ parentLinkType: parentLinkType.trim() });
  }

  protected setSubjectField(subjectField: string) {
    this.emit({ subjectField: subjectField.trim() });
  }

  protected commitParentTypes() {
    this.emit({
      parentIssueTypeNames: [
        ...new Set(
          this.typedParentTypes()
            .split(',')
            .map((name) => name.trim())
            .filter(Boolean),
        ),
      ],
    });
  }

  private emit(change: Partial<TimetrackTicketSettings>) {
    this.settingsChange.emit({ ...this.settings(), ...change });
  }
}
