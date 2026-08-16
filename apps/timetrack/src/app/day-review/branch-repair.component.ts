import { Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import { BANNER_IMPORTS, BUTTON_IMPORTS, SpinnerComponent } from '@ethlete/components';
import { BranchRepairOutcome, BranchRepairPlan } from '@ethlete/timetrack';

/**
 * The branch repair a filed ticket makes possible, shown in full before any of it runs.
 *
 * Every step names the exact command, and so does the undo beside it — a rename that touches a
 * remote is not something to confirm on trust. A plan that refuses shows why and offers no button
 * at all, rather than failing at the first step for a reason that was knowable up front.
 */
@Component({
  selector: 'ethlete-branch-repair',
  template: `
    <div class="flex flex-col gap-3 rounded-md border border-et-surface-border p-3">
      <div class="flex flex-wrap items-baseline gap-3">
        <h4 class="grow text-h4">Make {{ plan().branch }} conform</h4>
        <button (click)="dismiss.emit()" et-button variant="transparent" size="sm">Close</button>
      </div>

      @if (outcome(); as done) {
        @if (done.failed; as failure) {
          <et-banner [description]="failure.message" type="error" heading="The repair stopped" />

          @if (done.undo.length) {
            <div class="flex flex-col gap-1">
              <span class="text-small">Run these to put back what did happen:</span>
              @for (command of done.undo; track command) {
                <code class="text-mono text-small">{{ command }}</code>
              }
            </div>
          }
        } @else {
          <et-banner [description]="doneDescription()" type="success" heading="Repaired" />
        }
      } @else {
        @for (refusal of plan().refusals; track refusal.rule) {
          <et-banner [description]="refusal.message" type="warning" heading="This cannot run" />
        }

        @if (plan().keepsName) {
          <et-banner
            description="GitLab cannot move an open merge request to a different source branch, and deleting the branch would close it. Only the merge request is retitled; rename the branch once it has merged."
            type="info"
            heading="The branch keeps its name"
          />
        }

        @if (plan().steps.length) {
          <ol class="flex flex-col gap-2">
            @for (step of plan().steps; track step.describe) {
              <li class="flex flex-col gap-1">
                <span class="text-small">{{ $index + 1 }}. {{ step.describe }}</span>
                @if (step.command) {
                  <code class="text-mono text-small text-et-surface-muted">{{ step.command }}</code>
                }
                <span class="text-small text-et-surface-muted">Undo: {{ step.undo }}</span>
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
        } @else if (!plan().refusals.length) {
          <p class="text-small text-et-surface-muted">
            {{ plan().issueKey }} is already named everywhere it needs to be.
          </p>
        }
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BANNER_IMPORTS, BUTTON_IMPORTS, SpinnerComponent],
})
export class BranchRepairComponent {
  public plan = input.required<BranchRepairPlan>();
  public outcome = input<BranchRepairOutcome | null>(null);
  public isRunning = input(false);
  public canRun = input(false);

  public run = output<void>();
  public dismiss = output<void>();

  protected doneDescription = computed(() => {
    const plan = this.plan();
    const count = this.outcome()?.completed.length ?? 0;

    return plan.newName
      ? `${plan.branch} is now ${plan.newName}. ${count} step(s) ran.`
      : `${count} step(s) ran. ${plan.branch} keeps its name.`;
  });
}
