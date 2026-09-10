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
import { projectKeyFor, streamKeyRepoPath } from '@ethlete/timetrack';
import { IssueSelectComponent } from '../../jira';
import { injectTimetrackSettings } from '../../settings/settings';
import { rowEntryOf } from './row-appointment';

/** The issue the row is logged against. Replaces the surface's own title field, which writes the same key. */
@Component({
  selector: 'ethlete-edit-issue',
  template: `
    <et-form-field>
      <et-label>Issue</et-label>
      <ethlete-issue-select
        [value]="issueKey()"
        [projectKey]="projectKey()"
        (valueChange)="pick($event)"
        ariaLabel="Issue for this band"
      />
    </et-form-field>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, IssueSelectComponent],
})
export class EditIssueComponent {
  private settings = injectTimetrackSettings();

  public draft = input.required<WritableSignal<Appointment>>();

  protected issueKey = computed(() => this.draft()().title);

  /**
   * The project the row's own checkout is logged into, so the picker offers that project and not the
   * whole instance. Empty for a row no checkout is behind - a call, a meeting - and for a checkout no
   * project link covers.
   */
  protected projectKey = computed(() => {
    const laneKey = rowEntryOf(this.draft()())?.row.laneKey;
    const repoPath = laneKey ? streamKeyRepoPath(laneKey) : undefined;

    if (!repoPath) return '';

    return projectKeyFor({ context: { repoPath }, links: this.settings.settings().projectLinks }) ?? '';
  });

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
