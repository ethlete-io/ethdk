import { Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import { BADGE_IMPORTS, BUTTON_IMPORTS } from '@ethlete/components';
import { TimetrackProjectLink, UnlinkedAgentSessions, agentSessionResyncOffers } from '@ethlete/timetrack';
import { ExplainComponent } from './explain.component';

const WHY = `An agent session in a checkout no link covered was read and then dropped, because there was no
project to file it into. The reading is what moved the cursor, so linking the checkout afterwards does not
bring those sessions back on its own.

This reads the logs of one checkout again from the top. Only the checkouts listed here can be offered it:
a session log is stored without an identity of its own, so reading a log that was already kept would
store every sample in it a second time.`;

/**
 * The sessions that were skipped while a checkout had no project link, offered back once one covers it.
 *
 * Nothing is listed until both halves have happened — sessions were dropped, and a link now names a
 * project for them. That is why this has no empty state: on a settled machine it is not there at all.
 */
@Component({
  selector: 'ethlete-agent-session-resync',
  template: `
    @if (offers().length) {
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-1">
          <h3 class="text-h4">Agent sessions waiting on a re-read</h3>
          <ethlete-explain [text]="WHY" label="re-reading a session log" />
        </div>

        @for (offer of offers(); track offer.cwd) {
          <div class="flex flex-wrap items-center gap-3 rounded-md border border-et-surface-border p-3">
            <span class="grow break-all text-mono text-small">{{ offer.cwd }}</span>
            <et-badge color="brand" size="sm">{{ offer.projectKey }}</et-badge>
            <span class="text-small text-et-surface-subtle">{{ offer.events }} skipped</span>

            <button
              [attr.aria-label]="'Read the session logs of ' + offer.cwd + ' again'"
              [disabled]="busy()"
              (click)="resync.emit([offer.cwd])"
              et-button
              variant="outline"
              size="sm"
            >
              Read them again
            </button>
          </div>
        }

        @if (offers().length > 1) {
          <div>
            <button [disabled]="busy()" (click)="resync.emit(paths())" et-button variant="transparent" size="sm">
              Read all {{ offers().length }} again
            </button>
          </div>
        }
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BADGE_IMPORTS, BUTTON_IMPORTS, ExplainComponent],
})
export class AgentSessionResyncComponent {
  public unlinked = input.required<readonly UnlinkedAgentSessions[]>();
  public links = input.required<readonly TimetrackProjectLink[]>();
  public busy = input(false);

  public resync = output<string[]>();

  protected readonly WHY = WHY;

  protected offers = computed(() => agentSessionResyncOffers({ unlinked: this.unlinked(), links: this.links() }));

  protected paths = computed(() => this.offers().map((offer) => offer.cwd));
}
