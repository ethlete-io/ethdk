import { Component, ViewEncapsulation, computed } from '@angular/core';
import { BUTTON_IMPORTS, SpinnerComponent } from '@ethlete/components';
import { injectJiraCatalog } from './jira-catalog';
import { injectTimetrackSettings } from '../settings/settings';

/**
 * What the issue pickers of the window are reading, and the one control that reads it again.
 *
 * One line rather than one per picker: a day has an issue picker per row, and each of them would
 * otherwise repeat the same sentence about the same list.
 */
@Component({
  selector: 'ethlete-issue-filter',
  template: `
    <div class="flex flex-wrap items-center gap-3">
      <span class="text-small text-et-surface-muted">{{ scope() }}</span>

      @if (catalog.isLoadingIssuesFor('')) {
        <et-spinner size="sm" />
      } @else {
        <button (click)="catalog.reloadIssues('')" et-button variant="transparent" size="sm">Read them again</button>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, SpinnerComponent],
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

    const count = this.catalog.issuesFor('').length;

    return `${count} open issue(s) in ${projects.map((project) => project.key).join(', ')}`;
  });
}
