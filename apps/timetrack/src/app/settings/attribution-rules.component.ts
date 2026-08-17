import { Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import { BADGE_IMPORTS, BUTTON_IMPORTS } from '@ethlete/components';
import { AttributionRule, describeAttributionRule, issueKeyOf } from '@ethlete/timetrack';
import { ExplainComponent } from './explain.component';

const WHY = `For repositories whose branch names carry no issue key. A rule for one branch beats the rule
for its whole repository, and a rule saying "no tickets here" hands that repository's time to the work
beside it instead.

They have to be visible and removable somewhere: a rule keeps attributing time long after the branch it
was written for is gone, and a wrong one nobody can find is a wrong worklog every day.`;

/**
 * The standing answers to "what does work here belong to", written by naming a stretch of the day in
 * the review.
 *
 * They have to be visible and removable somewhere: a rule keeps attributing time long after the branch
 * it was written for is gone, and a wrong one nobody can find is a wrong worklog every day.
 */
@Component({
  selector: 'ethlete-attribution-rules',
  template: `
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-1">
        <h3 class="text-h4">Where work is logged by default</h3>
        <ethlete-explain [text]="WHY" label="standing answers" />
      </div>

      @for (rule of listed(); track rule.id) {
        <div class="flex flex-wrap items-center gap-3 rounded-md border border-et-surface-border p-3">
          <et-badge [color]="rule.color" size="sm">{{ rule.scope }}</et-badge>
          <span class="grow break-all text-mono text-small">{{ rule.label }}</span>
          <span class="w-24 shrink-0 text-small">{{ rule.target }}</span>

          <button
            [attr.aria-label]="'Forget the rule for ' + rule.label"
            (click)="remove.emit(rule.id)"
            et-button
            variant="transparent"
            size="sm"
          >
            Remove
          </button>
        </div>
      } @empty {
        <p class="text-small text-et-surface-subtle">
          None yet. Name a stretch of unattributed work in the day review to write one.
        </p>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BADGE_IMPORTS, BUTTON_IMPORTS, ExplainComponent],
})
export class AttributionRulesComponent {
  public rules = input.required<readonly AttributionRule[]>();

  public remove = output<string>();

  protected readonly WHY = WHY;

  protected listed = computed(() =>
    this.rules().map((rule) => ({
      id: rule.id,
      label: describeAttributionRule(rule),
      target: issueKeyOf(rule) ?? 'with the work beside it',
      scope: rule.branch ? 'branch' : rule.repoPath ? 'repository' : 'app',
      color: rule.branch ? 'brand' : 'warning',
    })),
  );
}
