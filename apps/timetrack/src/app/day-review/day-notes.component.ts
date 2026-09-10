import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { CallWindow, READABLE_MS, StreamDay, callLabel, formatDurationMs, unnamedFocusMs } from '@ethlete/timetrack';
import { injectWindowCollector } from '../../collectors';
import { formatClockTime } from './format';
import { formatRebuilt, formatSpend } from './stream-format';

const NAMES_NONE =
  'A window whose title holds no checkout names none, and its time folds into Other applications. Sources says which applications this is.';

const NO_DIRECTORY =
  'This machine cannot read the directory a focused window works in, so a window names a checkout only when its title holds one. Sources says what each collector reads.';

/**
 * What the day holds that is neither a row nor a stream: the part nothing watched, the calls, the
 * checkout names that were ambiguous, the window time no checkout took, and the turns no checkout can
 * carry.
 *
 * Each of them is a number the timeline cannot show and the day does not reconcile without. A folded
 * Other applications line with nothing saying what it is made of reads as a fault the user cannot act
 * on, which is the one thing this screen must never do.
 */
@Component({
  selector: 'ethlete-day-notes',
  template: `
    @if (rebuilt(); as rebuilt) {
      <div class="flex flex-col gap-1 rounded-md border border-dashed border-et-surface-border px-3 py-2">
        <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span class="text-base" data-rebuilt-label>Part of this day was rebuilt</span>
          <span class="text-small text-et-surface-muted" data-rebuilt-note>{{ rebuilt }}</span>
        </div>

        <span class="text-small text-et-surface-subtle">
          No window and no idle transition watched those minutes. They come from the prompts you typed and the commits
          you made, and an agent's turns hold a stretch open between two of them.
        </span>
      </div>
    }

    @if (calls().length) {
      <div class="flex flex-col gap-1 rounded-md border border-dashed border-et-surface-border px-3 py-2" data-calls>
        <span class="text-base" data-calls-label>Calls</span>

        <ul class="flex list-none flex-col gap-0.5">
          @for (call of calls(); track call.appId + call.from.getTime()) {
            <li [attr.data-call]="call.appId" class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-small">
              <span class="text-mono shrink-0 text-et-surface-muted">{{ CALL_SPAN_OF(call) }}</span>
              <span [title]="call.appId" class="min-w-0 truncate">{{ CALL_LABEL_OF(call) }}</span>
              <span class="text-et-surface-muted">{{ CALL_LENGTH_OF(call) }}</span>
              <span class="text-et-surface-subtle" data-call-attended>{{ CALL_ATTENDED_OF(call) }} in front</span>

              @if (!call.countsAsWork) {
                <span class="text-et-surface-subtle" data-call-unclassified>not counted</span>
              }
            </li>
          }
        </ul>

        <span class="text-small text-et-surface-subtle">
          A call is presence: an hour spent listening leaves no keystroke, so nothing else sees it. Whether it was work
          is your call, and a call no rule names is not counted. Write the rule in Settings. A call you never brought to
          the front is read as a voice room left open, and is not counted either.
        </span>
      </div>
    }

    @if (ambiguous(); as names) {
      <div class="flex flex-col gap-1 rounded-md border border-dashed border-et-surface-border px-3 py-2">
        <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span class="text-base" data-ambiguous-label>Names that match more than one checkout</span>
          <span class="text-mono text-small text-et-surface-muted" data-ambiguous>{{ names }}</span>
        </div>

        <span class="text-small text-et-surface-subtle">
          A window named these, and each name has more than one checkout. Their time is in Other applications.
        </span>
      </div>
    }

    @if (unnamed(); as read) {
      <div class="flex flex-col gap-1 rounded-md border border-dashed border-et-surface-border px-3 py-2">
        <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span class="text-base" data-unnamed-label>No checkout named this window time</span>
          <span class="text-small text-et-surface-muted" data-unnamed-today>{{ read.duration }}</span>
        </div>

        <span class="text-small text-et-surface-subtle">{{ read.why }}</span>
      </div>
    }

    @if (unattributed(); as spend) {
      <div class="flex flex-col gap-1 rounded-md border border-dashed border-et-surface-border px-3 py-2">
        <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span class="text-base" data-unattributed-label>No checkout for this spend</span>
          <span class="text-small text-et-surface-muted" data-unattributed>{{ spend }}</span>
        </div>

        <span class="text-small text-et-surface-subtle">
          These turns name no working directory, so no line can carry them.
        </span>
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'contents' },
})
export class DayNotesComponent {
  private windows = injectWindowCollector();
  public day = input.required<StreamDay | null>();

  /** Absent while nothing is watching, which is when no capability may be claimed either way. */
  private readsDirectory = computed(
    () =>
      this.windows.status()?.capabilities.find((capability) => capability.reads === 'working-directory')?.available !==
      false,
  );

  protected rebuilt = computed(() => formatRebuilt(this.day()?.rebuiltMs ?? 0));
  protected calls = computed(() => this.day()?.calls ?? []);

  /**
   * How much of the Other applications line no checkout could be named for, and why. Which
   * applications it is made of is the Sources view's job; this says only how much, and what this
   * machine cannot read. Empty under `READABLE_MS`, because a line carrying `0m` carries nothing.
   */
  protected unnamed = computed(() => {
    const ms = unnamedFocusMs(this.day()?.unnamedFocus ?? []);

    if (ms < READABLE_MS) return null;

    return { duration: formatDurationMs(ms), why: this.readsDirectory() ? NAMES_NONE : NO_DIRECTORY };
  });

  /**
   * The turns that name no checkout. Without it the day does not reconcile: the lines and this
   * remainder together are the whole of what the agents spent.
   */
  protected unattributed = computed(() => {
    const day = this.day();

    return day ? formatSpend(day.unattributedSpend) : '';
  });

  /** The checkout names the day had to drop, so the folded line holds no time nobody can place. */
  protected ambiguous = computed(() => (this.day()?.ambiguousNames ?? []).join(', '));

  protected readonly CALL_LABEL_OF = callLabel;

  protected CALL_SPAN_OF(call: CallWindow) {
    return `${formatClockTime(call.from)} – ${formatClockTime(call.to)}`;
  }

  protected CALL_LENGTH_OF(call: CallWindow) {
    return formatDurationMs(call.to.getTime() - call.from.getTime());
  }

  protected CALL_ATTENDED_OF(call: CallWindow) {
    return formatDurationMs(call.attendedMs);
  }
}
