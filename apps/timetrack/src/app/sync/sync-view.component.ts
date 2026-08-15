import { Component, ViewEncapsulation, computed } from '@angular/core';
import {
  BADGE_IMPORTS,
  BANNER_IMPORTS,
  BUTTON_IMPORTS,
  EMPTY_STATE_IMPORTS,
  SpinnerComponent,
} from '@ethlete/components';
import {
  ReviewedRow,
  TempoSyncCreateReason,
  TempoSyncDeleteReason,
  TempoSyncRow,
  TempoSyncRowKind,
  TempoSyncRowStatus,
  TempoSyncUpdateReason,
  TempoWorklog,
  formatDurationMs,
} from '@ethlete/timetrack';
import { formatClockTime, formatDayLabel } from '../day-review/format';
import { injectTempoSync } from './sync';

type SyncEntryKind = 'create' | 'update' | 'delete';

type SyncEntry = {
  id: string;
  kind: SyncEntryKind;
  color: string;
  reason: string;
  issueKey: string;
  clock: string;
  duration: string;
  description: string;
};

const REASONS: Record<TempoSyncCreateReason | TempoSyncUpdateReason | TempoSyncDeleteReason, string> = {
  new: 'not in Tempo yet',
  'recreated-after-remote-delete': 'was deleted in Tempo',
  'recreated-after-issue-change': 'moved to another issue',
  'content-changed': 'edited here',
  'changed-in-tempo': 'edited in Tempo',
  'proposal-removed': 'the row it came from is gone',
  'proposal-rejected': 'rejected in review',
  'no-time-left': 'rounded away to nothing',
  'issue-changed': 'moved to another issue',
};

const BADGE_COLORS: Record<SyncEntryKind, string> = { create: 'success', update: 'brand', delete: 'danger' };

type SyncResult = {
  id: string;
  kind: TempoSyncRowKind;
  status: TempoSyncRowStatus;
  color: string;
  issueKey: string;
  description: string;
  detail: string;
};

const STATUS_COLORS: Record<TempoSyncRowStatus, string> = {
  written: 'success',
  blocked: 'warning',
  skipped: 'warning',
  failed: 'danger',
};

/**
 * What a sync of the reviewed day would do, and the confirm that carries it out.
 *
 * Nothing is written until the reviewer presses the write button, and a plan can only be written once —
 * reading a fresh one is how a second attempt is made, so a row that landed is never sent twice.
 *
 * The foreign list is the half that matters most: it is time already logged against the account,
 * whoever wrote it, and the app will neither touch it nor propose it a second time.
 */
@Component({
  selector: 'ethlete-sync',
  template: `
    <div class="flex w-full max-w-7xl flex-col gap-3 p-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-col gap-1">
          <h2 class="text-h3">Sync</h2>
          <p class="text-small text-et-surface-muted">{{ dayLabel() }} — plan this day, then write it to Tempo.</p>
        </div>

        <div class="flex items-center gap-2">
          <button
            [disabled]="!connected() || store.isLoading() || store.isWriting()"
            (click)="store.refresh()"
            et-button
            variant="outline"
          >
            {{ store.plan() ? 'Plan again' : 'Plan this day' }}
          </button>

          @if (store.writeCount()) {
            <button [disabled]="!store.canSync()" (click)="store.sync()" et-button variant="filled">
              {{ writeLabel() }}
            </button>
          }
        </div>
      </div>

      @if (!connected()) {
        <et-banner [description]="missing()" type="warning" heading="Not connected yet" />
      }

      @if (store.failure(); as failure) {
        <et-banner [description]="failure" type="error" heading="This day could not be planned" />
      }

      @if (store.isLoading()) {
        <div class="flex items-center gap-3 text-et-surface-muted">
          <et-spinner />
          <span class="text-base">Asking Jira and Tempo…</span>
        </div>
      } @else if (store.plan(); as plan) {
        <p class="text-small text-et-surface-muted">
          As {{ store.account()?.displayName }} — {{ entries().length }} write(s), {{ plan.unchanged.length }} already
          in Tempo, {{ plan.skipped.length }} still awaiting review.
        </p>

        @if (entries().length) {
          <div class="flex flex-col gap-2">
            @for (entry of entries(); track entry.id) {
              <div class="flex flex-wrap items-center gap-3 rounded-md border border-et-surface-border p-3">
                <et-badge [color]="entry.color" size="sm">{{ entry.kind }}</et-badge>
                <span class="w-24 shrink-0 text-small">{{ entry.issueKey }}</span>
                <span class="w-28 shrink-0 text-mono text-small text-et-surface-muted">{{ entry.clock }}</span>
                <span class="w-14 shrink-0 text-small">{{ entry.duration }}</span>
                <span class="min-w-50 grow text-small">{{ entry.description }}</span>
                <span class="text-small text-et-surface-subtle">{{ entry.reason }}</span>
              </div>
            }
          </div>
        } @else {
          <et-empty-state
            description="Every reviewed row on this day already matches what Tempo holds."
            heading="Nothing to write"
          />
        }

        @if (plan.unresolved.length) {
          <et-banner [description]="unresolved()" type="warning" heading="Jira does not know these keys" />
        }

        <div class="flex flex-col gap-2">
          <h3 class="text-large">Already in Tempo</h3>

          @if (foreign().length) {
            <p class="text-small text-et-surface-muted">
              Written outside this app. It is never edited or deleted here.
            </p>

            @for (worklog of foreign(); track worklog.id) {
              <div class="flex flex-wrap items-center gap-3 rounded-md border border-et-surface-border p-3">
                <span class="w-24 shrink-0 text-small">{{ worklog.issueKey }}</span>
                <span class="w-28 shrink-0 text-mono text-small text-et-surface-muted">{{ worklog.clock }}</span>
                <span class="w-14 shrink-0 text-small">{{ worklog.duration }}</span>
                <span class="min-w-50 grow text-small">{{ worklog.description }}</span>
              </div>
            }
          } @else {
            <p class="text-small text-et-surface-muted">Nothing on this day was logged outside this app.</p>
          }
        </div>
      } @else if (connected()) {
        <et-empty-state
          description="Reads Jira and Tempo to work out what a sync of this day would create, update and delete."
          heading="No plan yet"
        />
      }

      @if (store.isWriting()) {
        <div class="flex items-center gap-3 text-et-surface-muted">
          <et-spinner />
          <span class="text-base">Writing to Tempo…</span>
        </div>
      }

      @if (store.runFailure(); as failure) {
        <et-banner [description]="failure" type="error" heading="Nothing was written" />
      }

      @if (store.unrecorded()) {
        <et-banner [description]="unrecorded()" type="error" heading="Written, but not recorded" />
      }

      @if (results().length) {
        <div class="flex flex-col gap-2">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h3 class="text-large">Last write</h3>

            @if (store.retryCount()) {
              <button [disabled]="store.isWriting()" (click)="store.retry()" et-button variant="outline" size="sm">
                {{ retryLabel() }}
              </button>
            }
          </div>

          @for (result of results(); track result.id) {
            <div class="flex flex-wrap items-center gap-3 rounded-md border border-et-surface-border p-3">
              <et-badge [color]="result.color" size="sm">{{ result.status }}</et-badge>
              <span class="w-24 shrink-0 text-small">{{ result.issueKey }}</span>
              <span class="w-14 shrink-0 text-small text-et-surface-subtle">{{ result.kind }}</span>
              <span class="min-w-50 grow text-small">{{ result.description }}</span>
              <span class="text-small text-et-surface-subtle">{{ result.detail }}</span>
            </div>
          }
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BADGE_IMPORTS, BANNER_IMPORTS, BUTTON_IMPORTS, EMPTY_STATE_IMPORTS, SpinnerComponent],
})
export class SyncViewComponent {
  protected store = injectTempoSync();

  protected dayLabel = computed(() => formatDayLabel(this.store.dayKey()));
  protected connected = computed(() => this.store.credentials().jira && this.store.credentials().tempo);

  protected missing = computed(() => {
    const credentials = this.store.credentials();
    const providers = [...(credentials.jira ? [] : ['Jira']), ...(credentials.tempo ? [] : ['Tempo'])];

    return `${providers.join(' and ')} must be configured in Settings before a day can be planned.`;
  });

  protected entries = computed((): SyncEntry[] => {
    const plan = this.store.plan();

    if (!plan) return [];

    const rows = new Map(this.store.rows().map((row) => [row.id, row]));

    return [
      ...plan.deletes.map((entry) =>
        this.entryOf({
          id: entry.proposalId,
          kind: 'delete',
          reason: REASONS[entry.reason],
          row: rows.get(entry.proposalId),
        }),
      ),
      ...plan.creates.map((entry) =>
        this.entryOf({ id: entry.proposal.id, kind: 'create', reason: REASONS[entry.reason], row: entry.proposal }),
      ),
      ...plan.updates.map((entry) =>
        this.entryOf({ id: entry.proposal.id, kind: 'update', reason: REASONS[entry.reason], row: entry.proposal }),
      ),
    ];
  });

  protected writeLabel = computed(() => {
    const count = this.store.writeCount();

    return `Write ${count} ${count === 1 ? 'change' : 'changes'} to Tempo`;
  });

  protected retryLabel = computed(() => {
    const count = this.store.retryCount();

    return `Retry ${count} ${count === 1 ? 'row' : 'rows'}`;
  });

  protected unrecorded = computed(() => {
    const message = this.store.unrecorded();

    return message
      ? `${message} — Tempo holds these worklogs but this app no longer owns them. Delete them in Tempo before writing this day again, or the same time is logged twice.`
      : '';
  });

  protected results = computed((): SyncResult[] => {
    const rows = new Map(this.store.rows().map((row) => [row.id, row]));

    return this.store.runRows().map((row) => ({
      id: `${row.kind}:${row.proposalId}`,
      kind: row.kind,
      status: row.status,
      color: STATUS_COLORS[row.status],
      issueKey: rows.get(row.proposalId)?.issueKey ?? row.proposalId,
      description: rows.get(row.proposalId)?.description || '(no description)',
      detail: this.detailOf(row),
    }));
  });

  protected unresolved = computed(() => {
    const keys = [...new Set((this.store.plan()?.unresolved ?? []).map((proposal) => proposal.issueKey))];

    return `${keys.join(', ')} — nothing is written for a row whose key has no issue id.`;
  });

  protected foreign = computed(() => {
    const plan = this.store.plan();
    const keys = this.store.keysByIssueId();

    return (plan?.foreign ?? []).map((worklog: TempoWorklog) => ({
      id: worklog.id,
      issueKey: keys.get(worklog.issueId) ?? `#${worklog.issueId}`,
      clock: formatClockTime(worklog.from),
      duration: formatDurationMs(worklog.durationMs),
      description: worklog.description || '(no description)',
    }));
  });

  private entryOf(options: {
    id: string;
    kind: SyncEntryKind;
    reason: string;
    row?: Pick<ReviewedRow, 'issueKey' | 'from' | 'to' | 'durationMs' | 'description'>;
  }): SyncEntry {
    const { row } = options;

    return {
      id: `${options.kind}:${options.id}`,
      kind: options.kind,
      color: BADGE_COLORS[options.kind],
      reason: options.reason,
      issueKey: row?.issueKey ?? options.id,
      clock: row ? `${formatClockTime(row.from)} – ${formatClockTime(row.to)}` : '—',
      duration: row ? formatDurationMs(row.durationMs) : '—',
      description: row?.description || '(no description)',
    };
  }

  private detailOf(row: TempoSyncRow) {
    if (row.status === 'written') return row.tempoWorklogId ? `worklog ${row.tempoWorklogId}` : 'done';
    if (row.status === 'blocked') return `needs ${(row.missing ?? []).map((attribute) => attribute.name).join(', ')}`;

    return row.error?.message ?? 'did not land';
  }
}
