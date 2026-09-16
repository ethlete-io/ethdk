import { Component, ViewEncapsulation, computed } from '@angular/core';
import {
  ACCORDION_IMPORTS,
  BANNER_IMPORTS,
  BUTTON_IMPORTS,
  EMPTY_STATE_IMPORTS,
  OVERLAY_CONTENT_IMPORTS,
  OverlayMainDirective,
  SpinnerComponent,
  defineOverlay,
  dialogOverlayStrategy,
} from '@ethlete/components';
import { formatDurationMs } from '@ethlete/timetrack';
import { BranchRepairComponent } from './branch-repair.component';
import { injectBranchRepair } from './branch-repair';
import { CreateTicketComponent } from './create-ticket.component';
import { injectDayReview } from './day-review';
import { DayNotesComponent } from './day-notes.component';
import { DayStreamsComponent } from './day-streams.component';
import { DayTotalsComponent } from './day-totals.component';
import { HiddenRowsComponent } from './hidden-rows.component';
import { IssueFilterComponent } from '../jira';
import { StandInsListComponent } from '../stand-ins';
import { LoggedElsewhereComponent } from './logged-elsewhere.component';
import { injectTicketDraft } from './ticket-draft';
import { TimerRunLabel, TimerRunsComponent } from './timer-runs.component';
import { ContextNaming, UnnamedWorkComponent } from './unnamed-work.component';

/**
 * Everything the day screen does not draw, behind one button.
 *
 * The timeline says what will be logged; a readout here says what was measured. The two disagree by
 * whatever the rounding moved, and on one screen that made the day look wrong when it was right. The
 * work still waiting for a name leads the stack, because it is the one panel a reviewer acts in.
 */
@Component({
  selector: 'ethlete-day-debug',
  template: `
    <div etOverlayHeader>
      <h2 class="text-h4" etOverlayTitle>Debug</h2>
    </div>

    <et-overlay-body>
      <et-accordion-group>
        <et-accordion [label]="waitingLabel()">
          <div class="flex flex-col gap-3">
            <ethlete-issue-filter />

            @if (store.unnamed().length) {
              <ethlete-unnamed-work
                [contexts]="store.unnamed()"
                [rules]="store.rulesByContext()"
                [suggestions]="store.inferredByContext()"
                [payload]="store.reasoningPayload()"
                [canAsk]="store.canAsk()"
                [isAsking]="store.isAsking()"
                [hasAsked]="store.hasAsked()"
                [askFailure]="store.askFailure()"
                [askedInVain]="store.askedInVain()"
                [standIns]="store.openStandIns()"
                (name)="nameContext($event)"
                (ask)="store.ask()"
                (createTicket)="tickets.open($event)"
                (openStandIn)="store.openStandInFor($event)"
                (markPrivate)="store.markPathPrivate($event)"
                (forget)="store.forgetRule($event)"
              />
            } @else {
              <et-empty-state
                description="Every band on this day is named, or nothing was observed that a rule could not read."
                heading="Nothing is waiting for a name"
              />
            }

            @if (tickets.context(); as drafting) {
              <ethlete-create-ticket
                [context]="drafting"
                [standIn]="tickets.standIn()"
                [createdParent]="tickets.createdParent()"
                [form]="tickets.form()"
                [candidates]="tickets.candidates()"
                [existing]="tickets.existing()"
                [agentMatch]="tickets.agentMatch()"
                [payload]="tickets.writingRequest()"
                [spec]="tickets.spec()"
                [isSearching]="tickets.isSearching()"
                [parentForm]="tickets.parentForm()"
                [parentTypeNames]="tickets.parentTypeNames()"
                [parentRule]="tickets.parentRule()"
                [canCreateParent]="tickets.canCreateParent()"
                [isCreatingParent]="tickets.isCreatingParent()"
                [createParentFailure]="tickets.createParentFailure()"
                [canWrite]="tickets.canWrite()"
                [canMatch]="tickets.canMatch()"
                [isWriting]="tickets.isWriting()"
                [isMatching]="tickets.isMatching()"
                [isWritingParent]="tickets.isWritingParent()"
                [parentPayload]="tickets.parentWritingRequest()"
                [parentWriteFailure]="tickets.parentWriteFailure()"
                [isCreating]="tickets.isCreating()"
                [canCreate]="tickets.canCreate()"
                [createGate]="tickets.createGate()"
                [createdKey]="tickets.createdKey()"
                [duplicateKey]="tickets.duplicateKey()"
                [searchFailure]="tickets.searchFailure()"
                [writeFailure]="tickets.writeFailure()"
                [matchFailure]="tickets.matchFailure()"
                [createFailure]="tickets.createFailure()"
                (projectKeyChange)="tickets.setProjectKey($event)"
                (summaryChange)="tickets.setSummary($event)"
                (descriptionChange)="tickets.setDescription($event)"
                (parentKeyChange)="tickets.setParentKey($event)"
                (findParents)="tickets.findParents()"
                (openParentForm)="tickets.openParentForm()"
                (closeParentForm)="tickets.closeParentForm()"
                (parentSummaryChange)="tickets.setParentSummary($event)"
                (parentDescriptionChange)="tickets.setParentDescription($event)"
                (parentIssueTypeNameChange)="tickets.setParentIssueTypeName($event)"
                (createParent)="tickets.createParent()"
                (write)="tickets.writeWithAgent()"
                (match)="tickets.matchWithAgent()"
                (writeParent)="tickets.writeParentWithAgent()"
                (useExisting)="tickets.useExisting($event)"
                (create)="tickets.create()"
                (dismiss)="tickets.close()"
              />
            }

            @if (repairOffer(); as offer) {
              <div class="flex flex-wrap items-center gap-3 rounded-md border border-et-surface-border p-3">
                <span class="grow text-small">
                  {{ offer.branch }} still names no issue. It can be renamed to carry {{ offer.issueKey }}.
                </span>
                <button (click)="repair.open(offer)" et-button variant="outline" size="sm">Show me the steps</button>
              </div>
            }

            @if (repair.isReading()) {
              <div class="flex items-center gap-3 text-et-surface-muted">
                <et-spinner size="sm" />
                <span class="text-small">Reading the repository…</span>
              </div>
            }

            @if (repair.readFailure(); as failure) {
              <et-banner [description]="failure" type="error" heading="The repository could not be read" />
            }

            @if (repair.plan(); as plan) {
              <ethlete-branch-repair
                [plan]="plan"
                [outcome]="repair.outcome()"
                [isRunning]="repair.isRunning()"
                [canRun]="repair.canRun()"
                (run)="repair.run()"
                (dismiss)="repair.close()"
              />
            }
          </div>
        </et-accordion>

        <et-accordion label="What was measured">
          <ethlete-day-totals [day]="store.day()" />
        </et-accordion>

        <et-accordion [label]="streamsLabel()">
          <ethlete-day-streams [day]="store.day()" [headBranches]="store.headBranches()" />
        </et-accordion>

        <et-accordion [label]="loggedLabel()">
          <div class="flex flex-col gap-3">
            <ethlete-logged-elsewhere [coverage]="store.coverage()" [privateTime]="store.privateTime()" />

            @if (store.timerRuns().length) {
              <ethlete-timer-runs
                [runs]="store.timerRuns()"
                [openRunId]="store.openRunId()"
                (label)="labelRun($event)"
              />
            }
          </div>
        </et-accordion>

        <et-accordion [label]="hiddenLabel()">
          <ethlete-hidden-rows [rows]="store.hiddenRows()" (show)="store.show($event)" />
        </et-accordion>

        <et-accordion label="Waiting on a ticket">
          <ethlete-stand-ins-list />
        </et-accordion>

        <et-accordion label="Day notes">
          <ethlete-day-notes [day]="store.day()" />
        </et-accordion>
      </et-accordion-group>
    </et-overlay-body>

    <div class="flex justify-end" etOverlayFooter>
      <button et-button etOverlayClose size="sm" variant="outline">Close</button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    ACCORDION_IMPORTS,
    BANNER_IMPORTS,
    BUTTON_IMPORTS,
    BranchRepairComponent,
    CreateTicketComponent,
    DayNotesComponent,
    DayStreamsComponent,
    DayTotalsComponent,
    EMPTY_STATE_IMPORTS,
    HiddenRowsComponent,
    IssueFilterComponent,
    LoggedElsewhereComponent,
    OVERLAY_CONTENT_IMPORTS,
    SpinnerComponent,
    StandInsListComponent,
    TimerRunsComponent,
    UnnamedWorkComponent,
  ],
  hostDirectives: [OverlayMainDirective],
})
export class DayDebugComponent {
  protected store = injectDayReview();
  protected tickets = injectTicketDraft();
  protected repair = injectBranchRepair();

  protected waitingLabel = computed(() => {
    const contexts = this.store.unnamed().length;

    return contexts ? `Waiting for a name — ${contexts} context(s)` : 'Waiting for a name — none';
  });

  protected streamsLabel = computed(() => {
    const count = this.store.day()?.streams.length ?? 0;

    if (!count) return 'Streams — nothing observed';

    const engaged = formatDurationMs(this.store.day()?.engagedMs ?? 0);

    return `Streams — ${count} ${count === 1 ? 'checkout' : 'checkouts'}, ${engaged} engaged`;
  });

  protected loggedLabel = computed(() => {
    const runs = this.store.timerRuns().length;
    const elsewhere = this.store.coverage()?.issues.length ?? 0;
    const secluded = this.store.privateTime().length;

    return `Logged elsewhere — ${elsewhere} in Tempo, ${secluded} private, ${runs} timed run(s)`;
  });

  protected hiddenLabel = computed(() => {
    const hidden = this.store.hiddenRows();
    const ms = hidden.reduce((sum, row) => sum + (row.to.getTime() - row.from.getTime()), 0);

    return `Hidden — ${hidden.length} row(s), ${formatDurationMs(ms)}`;
  });

  /**
   * The repair a just-filed ticket makes possible. It appears only once the key exists, because the
   * whole point of repair is to put that key into the branch name. A key the project already held
   * counts: the branch needs it in its name either way.
   */
  protected repairOffer = computed(() => {
    const issueKey = this.tickets.createdKey() ?? this.tickets.duplicateKey();
    const context = this.tickets.context()?.context;

    if (!issueKey || !context?.repoPath || !this.repair.isRepairable(context.branch) || this.repair.target()) {
      return null;
    }

    return { repoPath: context.repoPath, branch: context.branch ?? '', issueKey };
  });

  protected labelRun(label: TimerRunLabel) {
    this.store.labelRun(label.id, { issueKey: label.issueKey, note: label.note });
  }

  protected nameContext(naming: ContextNaming) {
    this.store.nameContext(naming.context, naming.target);
  }
}

export const DAY_DEBUG_OVERLAY = /* @__PURE__ */ defineOverlay({
  component: DayDebugComponent,
  strategies: dialogOverlayStrategy({ width: 'min(860px, 90%)', maxWidth: '90%' }),
});
