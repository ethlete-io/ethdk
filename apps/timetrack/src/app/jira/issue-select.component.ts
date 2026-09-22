import { Component, ViewEncapsulation, computed, effect, input, output, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { SELECT_IMPORTS } from '@ethlete/components';
import { JiraIssue } from '@ethlete/timetrack';
import { injectJiraCatalog } from './jira-catalog';
import { injectLaneIssueHistory } from './lane-issue-history';

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
 * Typing searches Jira rather than the list in hand, because the list is one page of it. A whole issue
 * key is answered by that one issue, whatever its project and whether or not it is closed — logging
 * against something nobody has opened in months has to stay possible, and a picker that refuses a key
 * the user knows is a picker they work around.
 *
 * The list is read when a picker is first opened rather than on mount, because a day has one of these
 * per row, and every picker of one project shares the read.
 *
 * `projectKey` narrows one picker to the project the row's own checkout is logged into. An empty list
 * then means no issue of that project was read, which is why the placeholder names the project: an
 * empty picker that says nothing reads as a defect.
 *
 * `laneKey` puts the issues this row's own lane was named with before in a group above the rest. It is
 * the same question the reviewer answers by hand every day — which work a checkout, or a standing
 * call, belongs to — and the answer barely moves from week to week. The group is filtered by whatever
 * is typed, the same way the list below it is, so it never offers a line the search rules out.
 *
 * The rest of the list gets a heading of its own whenever that group is there. A short-cut group that
 * runs straight into the full list reads as one list under the short-cut's own heading, which says
 * the lane was named with every issue the instance holds.
 */
@Component({
  selector: 'ethlete-issue-select',
  template: `
    <ng-template #line let-option>
      <span class="flex min-w-0 items-baseline gap-2">
        <span class="shrink-0 text-mono text-small">{{ option.key }}</span>
        <span class="min-w-0 grow truncate text-small">{{ option.summary }}</span>
        @if (option.issueType) {
          <span class="shrink-0 text-small text-et-surface-subtle">{{ option.issueType }}</span>
        }
      </span>
    </ng-template>

    <et-select
      [value]="value() || null"
      [placeholder]="placeholderText()"
      [loading]="catalog.isLoadingIssuesFor(scope())"
      [error]="catalog.issueFailureFor(scope())"
      [aria-label]="ariaLabel()"
      (valueChange)="pick($event)"
      (openChange)="open.set($event)"
      (queryChange)="query.set($event)"
      allowCustomValues
      filterMode="external"
    >
      <!-- a single select with an inline search shows its value in that input, so its placeholder is
           the one the closed field reads -->
      <input [placeholder]="placeholderText()" etSelectSearch />

      <ng-template #rest>
        @for (option of options(); track option.key) {
          <et-select-option [value]="option.key" [label]="option.label">
            <ng-container [ngTemplateOutlet]="line" [ngTemplateOutletContext]="{ $implicit: option }" />
          </et-select-option>
        }
      </ng-template>

      @if (remembered().length) {
        <et-select-option-group label="Used here before">
          @for (option of remembered(); track option.key) {
            <et-select-option [value]="option.key" [label]="option.label">
              <ng-container [ngTemplateOutlet]="line" [ngTemplateOutletContext]="{ $implicit: option }" />
            </et-select-option>
          }
        </et-select-option-group>

        @if (options().length) {
          <et-select-option-group label="All issues">
            <ng-container [ngTemplateOutlet]="rest" />
          </et-select-option-group>
        }
      } @else {
        <ng-container [ngTemplateOutlet]="rest" />
      }
    </et-select>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet, SELECT_IMPORTS],
  host: { class: 'flex min-w-0 grow' },
})
export class IssueSelectComponent {
  protected catalog = injectJiraCatalog();
  public history = injectLaneIssueHistory();
  public value = input('');
  public placeholder = input('');
  /** Offers only this project's issues. Empty offers every project the catalog read. */
  public projectKey = input('');
  /** Offers what this lane was named with before, above the rest. Empty offers no such group. */
  public laneKey = input('');
  public ariaLabel = input<string | null>(null);

  /** The key that was picked or typed. Empty when the field was cleared. */
  public valueChange = output<string>();

  public scope = computed(() => this.projectKey().trim().toUpperCase());

  protected placeholderText = computed(
    () => this.placeholder() || (this.scope() ? `Pick a ${this.scope()} issue` : 'Pick an issue'),
  );

  protected open = signal(false);
  protected query = signal('');

  private uses = computed(() => this.history.usesFor(this.laneKey()));

  /**
   * The lane's own issues, as lines of the same shape as the list below.
   *
   * A key whose summary is not read yet is still offered, reading as the bare key. It is the key that
   * books, and holding the line back until Jira answers would make the group appear under the user's
   * pointer.
   */
  protected remembered = computed(() => {
    const text = this.query().trim().toLowerCase();
    const lines = this.uses().map((use) => toOption(this.catalog.issueForKey(use.issueKey) ?? bareIssue(use.issueKey)));

    return text ? lines.filter((line) => line.label.toLowerCase().includes(text)) : lines;
  });

  protected options = computed(() => {
    const above = new Set(this.remembered().map((option) => option.key));

    return this.catalog
      .issuesFor(this.scope())
      .map(toOption)
      .filter((option) => !above.has(option.key));
  });

  constructor() {
    effect(() => {
      const scope = this.scope();
      const text = this.query();

      if (!this.open()) return;

      untracked(() => this.catalog.askForIssues({ scope, text }));
    });

    effect(() => {
      if (!this.open() || !this.laneKey()) return;

      const keys = this.uses().map((use) => use.issueKey);

      untracked(() => {
        this.history.load();
        this.catalog.askForIssueKeys(keys);
      });
    });
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
  label: `${issue.key} ${issue.summary}`.trim(),
});

const bareIssue = (key: string): JiraIssue => ({ id: '', key, summary: '', issueType: '' });

const clipped = (summary: string) =>
  summary.length > SUMMARY_LENGTH ? `${summary.slice(0, SUMMARY_LENGTH - 1).trimEnd()}…` : summary;
