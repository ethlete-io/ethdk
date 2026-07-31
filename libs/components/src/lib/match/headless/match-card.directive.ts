import { booleanAttribute, computed, Directive, ElementRef, inject, input } from '@angular/core';
import { format } from 'date-fns';
import { injectDateLocale } from '../../forms/date-time/date-time-formats';
import { injectMatchLabels, MatchLabels } from '../match-labels';
import { matchParticipantDisplayName } from '../match-participant-name';
import { NormalizedGameScore, NormalizedMatch } from '../match.types';
import { MATCH_CARD_TOKEN } from './match-card.tokens';

export const MATCH_CARD_SIZES = {
  /** Let the card's own width decide — the container-query default. */
  AUTO: 'auto',
  /** Always the dense row: short codes, no per-game breakdown. */
  COMPACT: 'compact',
  /** Always the featured card: big emblems, per-game breakdown, sides stacked. */
  EXPANDED: 'expanded',
  /** Always the wide row: the two sides face each other across the middle, results meeting in it. */
  WIDE: 'wide',
} as const;

export type MatchCardSize = (typeof MATCH_CARD_SIZES)[keyof typeof MATCH_CARD_SIZES];

/**
 * The kick-off format when none is given: the active locale's short date and short time. Deliberately
 * unambiguous rather than pretty — a match list spanning a season can't rely on "Sat 15:30".
 */
export const DEFAULT_MATCH_CARD_START_TIME_FORMAT = 'P p';

/** Elements that are focusable and clickable on their own, so the card doesn't have to fake it. */
const NATIVELY_INTERACTIVE_TAGS = ['A', 'BUTTON'];

/**
 * Headless match card: takes a {@link NormalizedMatch} and works out everything a card draws — the
 * score as one string, the kick-off in the active locale, who won, and the single composed name the
 * whole thing announces itself by.
 *
 * It imposes no template. Put it on the element that *is* the card, and read the state off it:
 *
 * @example
 * <a [match]="match()" [routerLink]="['/matches', match().id]" etMatchCard>
 *   <span>{{ card.homeName() }}</span>
 *   <span etMatchCardScore>{{ card.result() }}</span>
 *   <span>{{ card.awayName() }}</span>
 * </a>
 *
 * **One interactive element.** The accessible name lands on the host, so the host is what should be the
 * link or the button — `<a etMatchCard routerLink>`, or composed with
 * [`etQueryParamOverlayLink`](/components/overlay-openers) for a shareable detail overlay. Nothing
 * inside a card may be a second click target; an affordance that needs its own (a pin, a follow button)
 * belongs next to the card, not in it.
 */
@Directive({
  selector: '[etMatchCard]',
  exportAs: 'etMatchCard',
  providers: [{ provide: MATCH_CARD_TOKEN, useExisting: MatchCardDirective }],
  host: {
    '[attr.data-status]': 'match().status',
    '[attr.data-size]': 'size()',
    '[attr.data-result-kind]': 'match().resultKind',
    '[attr.data-winner]': 'match().winnerSide',
    '[attr.data-interactive]': 'isInteractive() ? "" : null',
    '[attr.data-hide-names]': 'hideNames() ? "" : null',
    '[attr.aria-label]': 'accessibleName()',
    // A card that isn't a link is still one thing rather than six loose fragments — but an unlabelled
    // `div` can't carry a name, so it becomes a group. A link or button already has a role of its own.
    '[attr.role]': 'isInteractive() ? null : "group"',
  },
})
export class MatchCardDirective {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private injectedLabels = injectMatchLabels();
  private dateLocale = injectDateLocale();

  /** The match to draw, already normalized — see {@link NormalizedMatch} and the `integrations/` adapters. */
  public match = input.required<NormalizedMatch>();

  /**
   * Which layout to render. `auto` (the default) lets the card's own inline size decide via a container
   * query — dense row, then featured card, then wide row as it gets wider; the other three fix it, for
   * a consumer who wants the same card everywhere regardless of width.
   *
   * Only an explicit `compact` swaps participant names for their short codes — a text change can't come
   * out of a container query, so `auto` keeps full names and lets them ellipsize.
   *
   * @default 'auto'
   */
  public size = input<MatchCardSize>(MATCH_CARD_SIZES.AUTO);

  /** Show each participant's seeding position, when they have one. @default false */
  public showSeeds = input(false, { transform: booleanAttribute });

  /**
   * Draw emblems only, no names. For the densest cell there is — a bracket that has to fit six rounds on
   * a phone. The names stay in the card's accessible name and in each emblem's `alt`, so nothing is lost
   * to assistive tech; give participants an `emblem` before turning this on, or every row looks alike.
   *
   * @default false
   */
  public hideNames = input(false, { transform: booleanAttribute });

  /**
   * The date-fns format the kick-off is drawn in. `null` uses
   * {@link DEFAULT_MATCH_CARD_START_TIME_FORMAT}; a rail of today's matches usually wants just `'p'`.
   */
  public startTimeFormat = input<string | null>(null);

  /**
   * Whether this card is a click target. `null` (the default) infers it from the host element, which is
   * right whenever the card is an `<a>` or `<button>`. Set it explicitly for a host that is interactive
   * some other way — a `<div>` wired to an overlay opener with its own `role` and `tabindex`.
   */
  public interactive = input<boolean | null>(null);

  /** Override this instance's strings — see {@link provideMatchLabels} for the app-wide version. */
  public labels = input<Partial<MatchLabels> | null>(null);

  /** The strings in effect here: the injected label set with this instance's `labels` applied. */
  public resolvedLabels = computed<MatchLabels>(() => ({ ...this.injectedLabels(), ...this.labels() }));

  private readonly IS_NATIVELY_INTERACTIVE = NATIVELY_INTERACTIVE_TAGS.includes(this.elementRef.nativeElement.tagName);

  /** Whether the card acts as a click target, and should therefore look and feel like one. */
  public isInteractive = computed(() => this.interactive() ?? this.IS_NATIVELY_INTERACTIVE);

  public isLive = computed(() => this.match().status === 'live');
  public isFinished = computed(() => this.match().status === 'finished');
  public isScheduled = computed(() => this.match().status === 'scheduled');

  /**
   * Whether participants render as short codes. Tied to an explicit `compact`, not to the rendered
   * width — see the `size` input.
   */
  public showsShortNames = computed(() => this.size() === MATCH_CARD_SIZES.COMPACT);

  /** The home side's name as it is announced: the full name, even where the card draws a code. */
  public homeName = computed(() =>
    matchParticipantDisplayName({ participant: this.match().home, labels: this.resolvedLabels() }),
  );

  /** The away side's name as it is announced. */
  public awayName = computed(() =>
    matchParticipantDisplayName({ participant: this.match().away, labels: this.resolvedLabels() }),
  );

  /** Whether the result is reported as W/L/D rather than as a pair of values. */
  public isOutcomeResult = computed(() => this.match().resultKind === 'outcome');

  /**
   * Whether the card draws the two headline values. The three result forms are mutually exclusive, so
   * this is false for an `outcome` match however many numbers happen to be on it.
   */
  public drawsScore = computed(
    () => !this.isOutcomeResult() && this.match().homeScore !== null && this.match().awayScore !== null,
  );

  /**
   * Whether the card draws W/L/D letters. Only once the match is over — before that an `outcome`
   * competition has nothing to say about it, and the kick-off carries the card instead.
   */
  public drawsOutcome = computed(() => this.isOutcomeResult() && this.isFinished());

  /** The winning side's display name, or `null` while the match is undecided or drawn. */
  public winnerName = computed(() => {
    const winnerSide = this.match().winnerSide;

    if (!winnerSide) return null;

    return winnerSide === 'home' ? this.homeName() : this.awayName();
  });

  /** The home side's W/L/D letter, or `null` when outcomes aren't drawn or the match isn't over. */
  public homeOutcome = computed(() => this.outcomeFor('home'));

  /** The away side's W/L/D letter, or `null`. */
  public awayOutcome = computed(() => this.outcomeFor('away'));

  /**
   * What goes between the two sides where they face each other: the score separator once there is
   * something to separate, otherwise the `versus` label. Only drawn in the wide arrangement — stacked,
   * the two sides need nothing between them.
   */
  public separatorText = computed(() => {
    const labels = this.resolvedLabels();

    return this.drawsScore() || this.drawsOutcome() ? labels.scoreSeparator.trim() : labels.versus;
  });

  /**
   * How the match stands, as one announced string — `'2 : 1'`, `'3 : 0 points'`, `'FC Berlin won'`.
   * Composed by the `resultName` label, because what the two values *mean* varies per competition (see
   * `NormalizedMatchResultKind`), and because a match reported only as a win and a loss still has
   * an outcome to announce while having nothing to read. `null` while there is neither.
   */
  public result = computed(() => {
    const { homeScore, awayScore, resultKind } = this.match();
    const drawsScore = this.drawsScore();

    if (!drawsScore && !this.drawsOutcome()) return null;

    return this.resolvedLabels().resultName({
      home: drawsScore ? `${homeScore}` : null,
      away: drawsScore ? `${awayScore}` : null,
      kind: resultKind,
      winner: this.winnerName(),
      separator: this.resolvedLabels().scoreSeparator,
    });
  });

  /** The per-game breakdown of a series, or `null` for a single game. */
  public gameScores = computed(() => this.match().gameScores);

  /** The kick-off in the active locale, or `null` when the match is unscheduled. */
  public formattedStartTime = computed(() => {
    const startTime = this.match().startTime;

    if (!startTime) return null;

    return format(startTime, this.startTimeFormat() ?? DEFAULT_MATCH_CARD_START_TIME_FORMAT, {
      locale: this.dateLocale ?? undefined,
    });
  });

  /**
   * The whole card as one string, from the `matchName` label. This is the card's accessible name, which
   * is why nothing inside it needs one: a screen reader reads the match, not six unrelated fragments.
   */
  public accessibleName = computed(() =>
    this.resolvedLabels().matchName({
      home: this.homeName(),
      away: this.awayName(),
      result: this.result(),
      resultKind: this.match().resultKind,
      winner: this.winnerName(),
      startTime: this.formattedStartTime(),
      status: this.match().status,
      label: this.match().label,
    }),
  );

  /** One game of the series, as the same `'13 : 11'` shape the headline score uses. */
  public gameScoreText({ home, away }: NormalizedGameScore) {
    return `${home}${this.resolvedLabels().scoreSeparator}${away}`;
  }

  /**
   * Derived rather than data: `winnerSide` already says who won, so a consumer never has to denormalize
   * that into two letters.
   */
  private outcomeFor(side: 'home' | 'away') {
    if (!this.drawsOutcome()) return null;

    const { winnerSide } = this.match();
    const labels = this.resolvedLabels();

    if (!winnerSide) return labels.outcomeDraw;

    return winnerSide === side ? labels.outcomeWin : labels.outcomeLoss;
  }
}
