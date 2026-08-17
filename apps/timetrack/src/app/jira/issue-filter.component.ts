import { Component, ViewEncapsulation, computed } from '@angular/core';
import { BUTTON_IMPORTS, CHOICE_FIELD_IMPORTS, SWITCH_IMPORTS, SpinnerComponent } from '@ethlete/components';
import { injectJiraCatalog } from './jira-catalog';
import { injectTimetrackSettings } from '../settings/settings';

/**
 * What every issue picker in the window offers: which projects, and whose issues.
 *
 * One control rather than one per picker, because the scope is one question. A day has an issue picker
 * per row, and asking it on each of them would be the same switch a dozen times over.
 */
@Component({
  selector: 'ethlete-issue-filter',
  template: `
    <div class="flex flex-wrap items-center gap-3">
      <et-choice-field>
        <et-switch [checked]="catalog.assignedToMe()" (checkedChange)="catalog.setAssignedToMe($event)" />
        <et-label>Only issues assigned to me</et-label>
      </et-choice-field>

      <span class="text-small text-et-surface-muted">{{ scope() }}</span>

      @if (catalog.isLoadingIssues()) {
        <et-spinner size="sm" />
      } @else {
        <button (click)="catalog.reloadIssues()" et-button variant="transparent" size="sm">Read them again</button>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, CHOICE_FIELD_IMPORTS, SWITCH_IMPORTS, SpinnerComponent],
})
export class IssueFilterComponent {
  protected catalog = injectJiraCatalog();
  private settings = injectTimetrackSettings();

  /**
   * What the pickers are reading, said in the terms the user configured it in. A project list nobody
   * has filled in is named as such: it is why the pickers are empty, and no spinner can say that.
   */
  protected scope = computed(() => {
    const projects = this.settings.settings().favoriteProjects;

    if (!projects.length) return 'No project is picked yet, so there is nothing to offer. Settings has the list.';

    const count = this.catalog.issues().length;

    return `${count} open issue(s) in ${projects.map((project) => project.key).join(', ')}`;
  });
}
