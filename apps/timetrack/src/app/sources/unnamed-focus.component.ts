import { Component, ViewEncapsulation, computed, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { BADGE_IMPORTS, BANNER_IMPORTS, BUTTON_IMPORTS } from '@ethlete/components';
import {
  READABLE_MS,
  UnnamedFocusReason,
  UnnamedFocusSpan,
  byLocalDay,
  dayKeysThrough,
  formatDurationMs,
  localDayKey,
  localDayRange,
  streamDay,
  unnamedFocusOver,
} from '@ethlete/timetrack';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { injectCallCollector, injectGitCollector, injectWindowCollector } from '../../collectors';
import { injectHostPorts } from '../../host';
import { injectTimetrackSettings } from '../settings/settings';
import { streamDayOptionsOf } from '../stream-day-options';
import { formatShare } from './format';

/** How far back the panel reads. Long enough that one unusual day cannot decide which rung to build. */
const SPAN_DAYS = 14;

const REASON_LABEL: Record<UnnamedFocusReason, string> = {
  'no-name': 'no checkout in the title',
  'ambiguous-name': 'a name two checkouts share',
  private: 'a private project',
  'own-window': 'this app',
};

/**
 * The causes that are the right answer rather than a defect.
 *
 * A name two checkouts share is not one of them: the paths differ, so the window is nameable, and the
 * day drops it only because a title is all it has to go on.
 */
const ON_PURPOSE: readonly UnnamedFocusReason[] = ['private', 'own-window'];

type Span = keyof typeof SPAN_LABEL;

type Loaded = { today: UnnamedFocusSpan; span: UnnamedFocusSpan } | null;

type FocusRow = {
  key: string;
  /** The application, or a stretch before the day's first focus sample, which no window is known for. */
  app: string;
  duration: string;
  why: string;
  onPurpose: boolean;
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const isOnPurpose = (reason: UnnamedFocusReason) => ON_PURPOSE.includes(reason);

/**
 * How much of the focused window's time no checkout took, per application, for today and for the last
 * fourteen days.
 *
 * It reports on the collectors rather than on a day, which is why it is here and not on the Today
 * screen: every minute it holds is already on that screen, folded into the Other applications line,
 * and this is the only place that says which applications the line is made of.
 *
 * It is permanent. Each rung of `plans/timetrack/name-the-window.md` changes this number, and the exit
 * test of that plan reads it before a rung and after it.
 */
@Component({
  selector: 'ethlete-unnamed-focus',
  template: `
    <section class="flex flex-col gap-2 rounded-md border border-et-surface-border p-3">
      <span class="text-base font-medium">Focus that named no checkout</span>

      <p class="text-small text-et-surface-muted">
        Every minute here is on the Today screen already, folded into the Other applications line. A private project and
        this app's own window are unnamed on purpose. The rest carries no checkout in the title.
      </p>

      @if (failure()) {
        <et-banner [description]="failure()!" type="error" heading="The measurement failed" />
      } @else if (!loaded()) {
        <p class="text-small text-et-surface-subtle">Reading the last {{ SPAN_DAYS }} days.</p>
      } @else {
        <div class="flex flex-wrap gap-2">
          @for (choice of SPANS; track choice) {
            <button
              [variant]="span() === choice ? 'filled' : 'outline'"
              [attr.data-span]="choice"
              [attr.aria-pressed]="span() === choice"
              (click)="span.set(choice)"
              et-button
              size="sm"
            >
              {{ SPAN_LABEL[choice] }}
            </button>
          }
        </div>

        <p class="text-small text-et-surface" data-unnamed-total>{{ total() }}</p>
        <p class="text-small text-et-surface-subtle" data-unnamed-unjudged>{{ unjudged() }}</p>

        <ul class="flex flex-col gap-1">
          @for (row of rows(); track row.key) {
            <li [attr.data-app]="row.app" class="flex flex-wrap items-baseline gap-2 text-small">
              <span class="font-medium">{{ row.app }}</span>
              <span class="tabular-nums">{{ row.duration }}</span>
              <span class="text-et-surface-muted">{{ row.why }}</span>

              @if (row.onPurpose) {
                <et-badge color="neutral" variant="outline" size="sm">on purpose</et-badge>
              }
            </li>
          } @empty {
            <li class="text-small text-et-surface-subtle">{{ emptyNote() }}</li>
          }
        </ul>
      }
    </section>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BADGE_IMPORTS, BANNER_IMPORTS, BUTTON_IMPORTS],
})
export class UnnamedFocusComponent {
  private ports = injectHostPorts();
  private windows = injectWindowCollector();
  private calls = injectCallCollector();
  private git = injectGitCollector();
  private settings = injectTimetrackSettings();

  protected span = signal<Span>('today');
  protected readonly SPANS = Object.keys(SPAN_LABEL) as Span[];
  protected readonly SPAN_LABEL = SPAN_LABEL;
  protected readonly SPAN_DAYS = SPAN_DAYS;

  /** Re-measured whenever a collector reports a run, so the number moves as the day is collected. */
  private probe = computed(() => ({
    day: localDayKey(new Date()),
    repoRoots: this.git.discovery()?.repos ?? [],
    settings: this.settings.settings(),
    windows: this.windows.lastRun(),
    calls: this.calls.lastRun(),
    git: this.git.lastRun(),
  }));

  private read = toSignal(
    toObservable(this.probe).pipe(
      switchMap((current) => {
        const days = dayKeysThrough({ day: current.day, count: SPAN_DAYS });
        const from = localDayRange(days[0] ?? current.day).from;
        const to = localDayRange(current.day).to;
        const options = streamDayOptionsOf({
          repoRoots: current.repoRoots,
          settings: current.settings,
          windowsSeenThroughMs: current.windows?.at.getTime(),
        });

        return this.ports.events.eventsBetween$(from, to).pipe(
          map((events) => {
            const perDay = byLocalDay({ items: events, days }).map((held) => streamDay({ events: held, options }));

            return {
              value: { today: unnamedFocusOver(perDay.slice(-1)), span: unnamedFocusOver(perDay) },
              failure: null,
            };
          }),
          catchError((error: unknown) => of({ value: null, failure: messageOf(error) })),
        );
      }),
      startWith(null),
    ),
    { initialValue: null },
  );

  protected loaded = computed<Loaded>(() => this.read()?.value ?? null);
  protected failure = computed(() => this.read()?.failure ?? null);

  private current = computed(() => this.loaded()?.[this.span()] ?? null);

  private unjudgedMs = computed(() =>
    (this.current()?.rows ?? []).filter((row) => !isOnPurpose(row.reason)).reduce((sum, row) => sum + row.ms, 0),
  );

  protected total = computed(() => {
    const read = this.current();

    if (!read) return '';
    if (!read.focusMs) return `${SPAN_LABEL[this.span()]}: no window held the focus.`;

    const { unnamedMs, focusMs } = read;

    return `${SPAN_LABEL[this.span()]}: ${formatDurationMs(unnamedMs)} of ${formatDurationMs(
      focusMs,
    )} focused named no checkout. That is ${formatShare({ ms: unnamedMs, ofMs: focusMs })}.`;
  });

  /**
   * What carries no checkout, without calling it wrong.
   *
   * A window a checkout should have taken and an application that is no work context at all both land
   * in `no-name`, and nothing collected so far tells them apart. Rung 3 of
   * `plans/timetrack/name-the-window.md` is what splits this line into the two.
   */
  protected unjudged = computed(() => {
    const read = this.current();

    if (!read?.focusMs) return '';

    const ms = this.unjudgedMs();

    if (!ms) return 'All of it is unnamed on purpose.';

    const held = ms === read.unnamedMs ? 'All of it' : `${formatDurationMs(ms)} of it`;

    return `${held} carries no checkout in the title. A window a checkout should have taken reads the same way as an application that is no work context at all, so the split between them is not known yet.`;
  });

  protected rows = computed<FocusRow[]>(() =>
    (this.current()?.rows ?? [])
      .filter((row) => row.ms >= READABLE_MS)
      .map((row) => ({
        key: `${row.appId ?? ''} ${row.reason}`,
        app: row.appId ?? 'no application reported',
        duration: formatDurationMs(row.ms),
        why: REASON_LABEL[row.reason],
        onPurpose: isOnPurpose(row.reason),
      })),
  );

  protected emptyNote = computed(() =>
    this.current()?.rows.length
      ? 'Every window that named no checkout held it for under a minute.'
      : 'Every window that held the focus named a checkout.',
  );
}

/** Declared below the component so its template literal cannot desynchronise the language service. */
const SPAN_LABEL = { today: 'Today', span: `Last ${SPAN_DAYS} days` };
