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
import { Appointment, FORM_FIELD_IMPORTS, injectSchedulerEditSurfaceHost } from '@ethlete/components';
import { IssueSelectComponent } from '../../jira';

/** The issue the row is logged against. Replaces the surface's own title field, which writes the same key. */
@Component({
  selector: 'ethlete-edit-issue',
  template: `
    <et-form-field>
      <et-label>Issue</et-label>
      <ethlete-issue-select [value]="issueKey()" (valueChange)="pick($event)" ariaLabel="Issue for this band" />
    </et-form-field>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, IssueSelectComponent],
})
export class EditIssueComponent {
  public draft = input.required<WritableSignal<Appointment>>();

  protected issueKey = computed(() => this.draft()().title);

  protected pick(issueKey: string) {
    this.draft().update((appointment) => ({ ...appointment, title: issueKey }));
  }
}

@Directive({ selector: '[ethleteEditIssue]' })
export class EditIssueDirective {
  private host = injectSchedulerEditSurfaceHost('ethleteEditIssue');

  constructor() {
    this.host.registerEditField({ component: EditIssueComponent, injector: inject(Injector), order: 0 });
  }
}
