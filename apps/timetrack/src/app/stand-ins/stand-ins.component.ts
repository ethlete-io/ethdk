import { Component, ViewEncapsulation, computed, signal } from '@angular/core';
import {
  BUTTON_IMPORTS,
  EMPTY_STATE_IMPORTS,
  OVERLAY_CONTENT_IMPORTS,
  OverlayMainDirective,
  defineOverlay,
  dialogOverlayStrategy,
} from '@ethlete/components';
import { ProvideColorDirective } from '@ethlete/core';
import { StandIn } from '@ethlete/timetrack';
import { IssueSelectComponent } from '../jira';
import { injectStandIns } from './stand-ins';

/**
 * What the user named before Jira held a ticket for it, and the three ways one ends.
 *
 * A stand-in books nothing, so a list that is never read is a day of work that never reaches Tempo.
 * Resolving one names the issue the work turned out to be and every band on every day it held takes
 * that key; deleting one puts those bands back to unnamed.
 */
@Component({
  selector: 'ethlete-stand-ins',
  template: `
    <div etOverlayHeader>
      <h2 class="text-h4" etOverlayTitle>Waiting on a ticket</h2>
    </div>

    <et-overlay-body>
      @if (listed().length) {
        <div class="flex flex-col gap-3">
          @for (entry of listed(); track entry.id) {
            <div
              [attr.data-stand-in]="entry.id"
              [attr.data-state]="entry.standIn.state"
              class="flex flex-col gap-3 rounded-md border border-et-surface-border p-3"
            >
              <div class="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                <span class="min-w-0 grow text-base">{{ entry.standIn.name }}</span>
                @if (entry.projectKey) {
                  <span class="shrink-0 text-mono text-small text-et-surface-muted">{{ entry.projectKey }}</span>
                }
                <span class="shrink-0 text-small text-et-surface-muted">{{ entry.days }}</span>
              </div>

              @if (entry.standIn.state === 'open') {
                <div class="flex flex-wrap items-center gap-2">
                  <ethlete-issue-select
                    [value]="draftFor(entry.id)"
                    [projectKey]="entry.projectKey"
                    [ariaLabel]="'Issue for ' + entry.standIn.name"
                    (valueChange)="setDraft(entry.id, $event)"
                    class="w-42 shrink-0"
                    placeholder="Issue"
                  />

                  <button [disabled]="!draftFor(entry.id)" (click)="resolve(entry.id)" et-button size="sm">
                    Resolve
                  </button>

                  <button
                    (click)="store.remove(entry.id)"
                    et-button
                    variant="outline"
                    size="sm"
                    etProvideColor="danger"
                  >
                    Delete
                  </button>
                </div>
              } @else {
                <div class="flex flex-wrap items-center gap-2">
                  <span class="min-w-0 grow text-small">
                    Resolved to <span class="text-mono">{{ entry.standIn.issueKey }}</span>
                  </span>

                  @if (entry.canReopen) {
                    <button (click)="store.reopen(entry.id)" et-button variant="outline" size="sm">Undo</button>
                  } @else {
                    <span class="text-small text-et-surface-muted">
                      A day it held is in Tempo, so the key is a correction from there on.
                    </span>
                  }

                  <button
                    (click)="store.remove(entry.id)"
                    et-button
                    variant="outline"
                    size="sm"
                    etProvideColor="danger"
                  >
                    Delete
                  </button>
                </div>
              }
            </div>
          }
        </div>
      } @else {
        <et-empty-state
          description="Name work here from the day screen, whenever it starts before Jira holds a ticket for it."
          heading="Nothing waits on a ticket"
        />
      }
    </et-overlay-body>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, EMPTY_STATE_IMPORTS, IssueSelectComponent, OVERLAY_CONTENT_IMPORTS, ProvideColorDirective],
  hostDirectives: [OverlayMainDirective],
})
export class StandInsComponent {
  protected store = injectStandIns();

  private drafts = signal<Record<string, string>>({});

  protected listed = computed(() =>
    this.store.standIns().map((standIn) => ({
      id: standIn.id,
      standIn,
      projectKey: standIn.projectKey ?? '',
      days: daysLabel(standIn),
      canReopen: this.store.canReopen(standIn),
    })),
  );

  protected draftFor(id: string) {
    return this.drafts()[id] ?? '';
  }

  protected setDraft(id: string, issueKey: string) {
    this.drafts.update((all) => ({ ...all, [id]: issueKey }));
  }

  protected resolve(id: string) {
    this.store.resolve({ id, issueKey: this.draftFor(id) });
    this.setDraft(id, '');
  }
}

/** The days a stand-in holds bands on, which are the days a resolve makes bookable. */
const daysLabel = (standIn: StandIn) => {
  const count = standIn.days.length;

  if (!count) return 'no day yet';

  return count === 1 ? `1 day · ${standIn.days[0]}` : `${count} days · ${standIn.days[0]} – ${standIn.days[count - 1]}`;
};

export const STAND_INS_OVERLAY = /* @__PURE__ */ defineOverlay({
  component: StandInsComponent,
  strategies: dialogOverlayStrategy({ width: 'min(720px, 90%)', maxWidth: '90%' }),
});
