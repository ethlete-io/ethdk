import { Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import { BANNER_IMPORTS, BUTTON_IMPORTS, SpinnerComponent } from '@ethlete/components';
import { WorkStartOutcome, WorkStartPlan } from '@ethlete/timetrack';

/**
 * What starting this work will do, shown in full before any of it runs.
 *
 * The branch carries `<KEY>` until Jira has filed the issue, because the key is the one thing that
 * cannot be known in advance — everything else is decided here, and every step names the exact
 * command and the exact undo beside it. A plan that refuses shows why and offers no button at all.
 */
@Component({
  selector: 'ethlete-work-start-plan',
  template: `
    <div class="flex flex-col gap-3 rounded-md border border-et-surface-border p-3">
      <h4 class="text-h4">What this will do</h4>

      @if (outcome(); as done) {
        @if (done.failed; as failure) {
          <et-banner [description]="failure.message" type="error" heading="The start stopped" />

          @if (done.issueKey; as key) {
            <p class="text-small">{{ key }} was filed and still exists.</p>
          }

          @if (done.undo.length) {
            <div class="flex flex-col gap-1">
              <span class="text-small">Run these to put back what did happen:</span>
              @for (command of done.undo; track command) {
                <code class="text-mono text-small">{{ command }}</code>
              }
            </div>
          }
        } @else {
          <et-banner [description]="doneDescription()" type="success" heading="Started" />

          @if (done.mergeRequestUrl; as url) {
            <div class="flex flex-col gap-1">
              <span class="text-small">The draft merge request:</span>
              <code class="text-mono text-small">{{ url }}</code>
            </div>
          }
        }

        <div>
          <button (click)="again.emit()" et-button variant="outline" size="sm">Start something else</button>
        </div>
      } @else {
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-small">
          <dt class="text-et-surface-muted">branch</dt>
          <dd class="text-mono">{{ plan().branch || '—' }}</dd>
          <dt class="text-et-surface-muted">from</dt>
          <dd class="text-mono">{{ plan().baseRef || '—' }}</dd>
          <dt class="text-et-surface-muted">merges to</dt>
          <dd class="text-mono">{{ plan().mrTarget || 'no merge request — this remote is not on GitLab' }}</dd>
        </dl>

        @for (refusal of plan().refusals; track refusal.rule) {
          <et-banner [description]="refusal.message" type="warning" heading="This cannot run" />
        }

        @if (plan().steps.length) {
          <ol class="flex flex-col gap-2">
            @for (step of plan().steps; track step.describe) {
              <li class="flex flex-col gap-1">
                <span class="text-small">{{ $index + 1 }}. {{ step.describe }}</span>
                @if (step.command) {
                  <code class="text-mono text-small text-et-surface-muted">{{ step.command }}</code>
                }
                @if (step.undo) {
                  <span class="text-small text-et-surface-muted">Undo: {{ step.undo }}</span>
                }
              </li>
            }
          </ol>

          <div class="flex items-center gap-3">
            <button [disabled]="!canRun() || isRunning()" (click)="run.emit()" et-button variant="filled" size="sm">
              @if (isRunning()) {
                <et-spinner size="sm" />
              }
              Run these steps
            </button>
            <span class="text-small text-et-surface-muted">Nothing runs until you press this.</span>
          </div>
        }
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BANNER_IMPORTS, BUTTON_IMPORTS, SpinnerComponent],
})
export class WorkStartPlanComponent {
  public plan = input.required<WorkStartPlan>();
  public outcome = input<WorkStartOutcome | null>(null);
  public isRunning = input(false);

  public run = output<void>();
  public again = output<void>();

  protected canRun = computed(() => {
    const plan = this.plan();

    return plan.refusals.length === 0 && plan.steps.length > 0;
  });

  protected doneDescription = computed(() => {
    const outcome = this.outcome();
    const on = outcome?.branch ? ` and you are on ${outcome.branch}` : '';

    return `${outcome?.issueKey ?? 'The issue'} is filed${on}. ${outcome?.completed.length ?? 0} step(s) ran.`;
  });
}
