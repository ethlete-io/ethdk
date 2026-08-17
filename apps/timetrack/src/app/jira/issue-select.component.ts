import { Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import { SELECT_IMPORTS } from '@ethlete/components';
import { JiraIssue } from '@ethlete/timetrack';
import { injectJiraCatalog } from './jira-catalog';

/** How long a summary may read in one line. Past this the key stops being the first thing seen. */
const SUMMARY_LENGTH = 68;

type IssueOption = {
  key: string;
  summary: string;
  issueType: string;
  /** What the select searches and what the closed field reads, so typing either half finds the issue. */
  label: string;
};

/**
 * Picks the issue a row is logged against.
 *
 * It offers the open issues of the projects the user picked and nothing else, which is the difference
 * between a list somebody reads and every issue an instance has ever held. One line per issue: the key
 * first, because that is what a reviewer recognises, then as much of the summary as fits on the line.
 *
 * A typed key is still accepted. The list is the hundred most recently touched issues, so the one
 * exception — logging against something nobody has opened in months — has to stay possible, and a
 * picker that refuses a key the user knows is a picker they work around.
 *
 * The list is read when a picker is first opened rather than on mount, because a day has one of these
 * per row. `ethlete-issue-filter` is where its scope is narrowed, once, for all of them.
 */
@Component({
  selector: 'ethlete-issue-select',
  template: `
    <et-select
      [value]="value() || null"
      [placeholder]="placeholder()"
      [loading]="catalog.isLoadingIssues()"
      [error]="catalog.issueFailure()"
      [aria-label]="ariaLabel()"
      (valueChange)="pick($event)"
      (openChange)="opened($event)"
      allowCustomValues
    >
      <!-- a single select with an inline search shows its value in that input, so its placeholder is
           the one the closed field reads -->
      <input [placeholder]="placeholder()" etSelectSearch />

      @for (option of options(); track option.key) {
        <et-select-option [value]="option.key" [label]="option.label">
          <span class="flex min-w-0 items-baseline gap-2">
            <span class="shrink-0 text-mono text-small">{{ option.key }}</span>
            <span class="min-w-0 grow truncate text-small">{{ option.summary }}</span>
            @if (option.issueType) {
              <span class="shrink-0 text-small text-et-surface-subtle">{{ option.issueType }}</span>
            }
          </span>
        </et-select-option>
      }
    </et-select>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SELECT_IMPORTS],
})
export class IssueSelectComponent {
  protected catalog = injectJiraCatalog();
  public value = input('');
  public placeholder = input('Pick an issue');
  public ariaLabel = input<string | null>(null);

  /** The key that was picked or typed. Empty when the field was cleared. */
  public valueChange = output<string>();

  protected options = computed(() => this.catalog.issues().map(toOption));

  protected opened(open: boolean) {
    if (open) this.catalog.loadIssues();
  }

  protected pick(value: unknown) {
    this.valueChange.emit(typeof value === 'string' ? value.trim().toUpperCase() : '');
  }
}

/** One line per issue: the key, a summary that fits it, and the type. */
const toOption = (issue: JiraIssue): IssueOption => ({
  key: issue.key,
  summary: clipped(issue.summary),
  issueType: issue.issueType,
  label: `${issue.key} ${issue.summary}`,
});

const clipped = (summary: string) =>
  summary.length > SUMMARY_LENGTH ? `${summary.slice(0, SUMMARY_LENGTH - 1).trimEnd()}…` : summary;
