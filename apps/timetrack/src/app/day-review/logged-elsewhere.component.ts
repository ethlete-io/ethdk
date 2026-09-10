import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { PrivateTime, TempoDayCoverage, formatDurationMs } from '@ethlete/timetrack';

/**
 * The time on this day that no sync will write: what Tempo already holds, and what a private path
 * held.
 *
 * Both are shown rather than only counted. A day logged by hand proposes nothing, and a reviewer who
 * cannot see that the app watched has no way to tell a working project link from a broken one.
 */
@Component({
  selector: 'ethlete-logged-elsewhere',
  template: `
    <div class="flex flex-col gap-3">
      @if (inTempo().length) {
        <div class="flex flex-col gap-2">
          <p class="text-small text-et-surface-muted">
            Time this day already holds, written outside this app. A sync leaves it alone.
          </p>

          @for (entry of inTempo(); track entry.issueKey) {
            <div class="flex flex-wrap items-center gap-3" data-tempo-entry>
              <span class="w-14 shrink-0 text-small">{{ entry.duration }}</span>
              <span class="grow text-mono text-small">{{ entry.issueKey }}</span>
            </div>
          }
        </div>
      }

      @for (entry of privateEntries(); track entry.id) {
        <div class="flex flex-wrap items-center gap-3" data-private-entry>
          <span class="w-14 shrink-0 text-small">{{ entry.duration }}</span>
          <span class="grow break-all text-mono text-small text-et-surface-muted">{{ entry.path }}</span>
          <span class="text-small text-et-surface-subtle">private — never logged</span>
        </div>
      }

      @if (!inTempo().length && !privateEntries().length) {
        <p class="text-small text-et-surface-subtle">Nothing on this day is logged outside this app.</p>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class LoggedElsewhereComponent {
  public coverage = input.required<TempoDayCoverage | null>();
  public privateTime = input.required<readonly PrivateTime[]>();

  /** What Tempo already holds, widest first, so the day shows it rather than only counting it. */
  protected inTempo = computed(() =>
    [...(this.coverage()?.issues ?? [])]
      .sort((a, b) => b.coveredMs - a.coveredMs)
      .map((issue) => ({ issueKey: issue.issueKey, duration: formatDurationMs(issue.coveredMs) })),
  );

  protected privateEntries = computed(() =>
    this.privateTime().map((entry) => ({
      id: entry.link.id,
      path: entry.link.path,
      duration: formatDurationMs(entry.observedMs),
    })),
  );
}
