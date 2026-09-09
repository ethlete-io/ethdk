import { Component, ViewEncapsulation, computed, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { BADGE_IMPORTS, BANNER_IMPORTS, BUTTON_IMPORTS } from '@ethlete/components';
import {
  READABLE_MS,
  UnnamedFocusReason,
  UnnamedFocusSpan,
  UnnamedFocusVerdict,
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
  'no-work-context': 'no work context',
};

const VERDICT_LABEL: Record<UnnamedFocusVerdict, string> = {
  'on-purpose': 'on purpose',
  gap: 'names one elsewhere',
  unknown: 'never names one',
};

const VERDICT_COLOR: Record<UnnamedFocusVerdict, string> = {
  'on-purpose': 'neutral',
  gap: 'warning',
  unknown: 'brand',
};

type Span = keyof typeof SPAN_LABEL;

type Loaded = { today: UnnamedFocusSpan; span: UnnamedFocusSpan } | null;

type FocusRow = {
  key: string;
  /** The application, or a stretch before the day's first focus sample, which no window is known for. */
  app: string;
  duration: string;
  why: string;
  standing: string;
  color: string;
  /** The application id the declaration is written against, or nothing for a row with no application. */
  appId?: string;
  declared: boolean;
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

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
        Every minute here is on the Today screen already, folded into the Other applications line. An application that
        names a checkout at another time lost this stretch. One that never names a checkout either holds no work context
        at all, or holds one this app cannot read yet.
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
        <p class="text-small text-et-surface-subtle" data-unnamed-gap>{{ gap() }}</p>
        <p class="text-small text-et-surface-subtle" data-unnamed-unknown>{{ unknown() }}</p>

        <ul class="flex flex-col gap-1">
          @for (row of rows(); track row.key) {
            <li [attr.data-app]="row.app" class="flex flex-wrap items-baseline gap-2 text-small">
              <span class="font-medium">{{ row.app }}</span>
              <span class="tabular-nums">{{ row.duration }}</span>
              <span class="text-et-surface-muted">{{ row.why }}</span>
              <et-badge [color]="row.color" variant="outline" size="sm">{{ row.standing }}</et-badge>

              @if (row.appId) {
                <button
                  [attr.data-declare]="row.appId"
                  (click)="declare(row)"
                  class="ml-auto"
                  et-button
                  variant="transparent"
                  size="sm"
                >
                  {{ row.declared ? 'It does hold work' : 'It holds no work' }}
                </button>
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

  protected total = computed(() => {
    const read = this.current();

    if (!read) return '';
    if (!read.focusMs) return `${SPAN_LABEL[this.span()]}: no window held the focus.`;

    const { unnamedMs, focusMs } = read;

    return `${SPAN_LABEL[this.span()]}: ${formatDurationMs(unnamedMs)} of ${formatDurationMs(
      focusMs,
    )} focused named no checkout. That is ${formatShare({ ms: unnamedMs, ofMs: focusMs })}.`;
  });

  /** The part this plan set out to fix: an application that names checkouts lost this stretch. */
  protected gap = computed(() => {
    const read = this.current();

    if (!read?.focusMs) return '';
    if (!read.gapMs) return 'No application that names checkouts lost any of it.';

    return `${formatDurationMs(read.gapMs)} of it is a window a checkout should have taken: the application named one at another time.`;
  });

  /**
   * The part nothing can judge yet.
   *
   * An application that never named a checkout is either no work context at all or one this app cannot
   * read a name for, and rungs 1 and 2 of `plans/timetrack/name-the-window.md` are what tell the two
   * apart. To call it a defect before then reports a number nobody can act on.
   */
  protected unknown = computed(() => {
    const read = this.current();

    if (!read?.focusMs || !read.unknownMs) return '';

    return `${formatDurationMs(read.unknownMs)} of it is an application that never named a checkout, so nothing here can say whether it should have.`;
  });

  protected rows = computed<FocusRow[]>(() =>
    (this.current()?.rows ?? [])
      .filter((row) => row.ms >= READABLE_MS)
      .map((row) => ({
        key: `${row.appId ?? ''} ${row.reason}`,
        app: row.appId ?? 'no application reported',
        duration: formatDurationMs(row.ms),
        why: REASON_LABEL[row.reason],
        standing: VERDICT_LABEL[row.verdict],
        color: VERDICT_COLOR[row.verdict],
        appId: row.appId,
        declared: row.reason === 'no-work-context',
      })),
  );

  protected emptyNote = computed(() =>
    this.current()?.rows.length
      ? 'Every window that named no checkout held it for under a minute.'
      : 'Every window that held the focus named a checkout.',
  );

  /**
   * Records, or withdraws, the one thing no collector can observe: that an application never holds a
   * checkout. It re-reads the span, so the row moves out of the unknown number as soon as it is saved.
   */
  protected declare(row: FocusRow) {
    if (!row.appId) return;

    if (row.declared) this.settings.removeNoWorkContextApp(row.appId);
    else this.settings.addNoWorkContextApp(row.appId);
  }
}

/** Declared below the component so its template literal cannot desynchronise the language service. */
const SPAN_LABEL = { today: 'Today', span: `Last ${SPAN_DAYS} days` };
