import { booleanAttribute, Component, computed, ElementRef, inject, input, ViewEncapsulation } from '@angular/core';
import { FocusRingDirective } from '../focus-ring';
import { PICTURE_IMPORTS } from '../picture';
import { SKELETON_IMPORTS } from '../skeleton';
import { injectMatchLabels, MatchLabels } from './match-labels';
import { matchParticipantDisplayName } from './match-participant-name';
import { NormalizedMatchParticipant } from './match.types';

/**
 * One side of a match, drawn: emblem, name, and an optional seed. Used inside `et-match-card` and on
 * its own wherever a team or player is listed — a roster, a standings row, a filter chip's content.
 *
 * A `null` participant is a **TBD slot**, not an error: a bracket match whose feeder hasn't finished
 * has a real place in the layout and no name to put in it. It renders the `tbd` label against an empty
 * emblem frame, so the row keeps its height and nothing jumps when the name arrives.
 *
 * `compact` swaps the name for the participant's `code` where it has one — the same participant, in a
 * bracket column that can't hold "Neon Esports Berlin".
 *
 * **Put it on an `<a>` or a `<button>`** to make the whole thing one click target — a player card that
 * opens a profile, a team row that filters a list. It detects that itself: the host is then named after the
 * participant (so the link doesn't read "FC Berlin emblem FC Berlin"), takes the shared focus ring, and gets
 * an interactive hover.
 *
 * @example
 * <et-match-participant [participant]="match().home" />
 *
 * @example
 * <!-- a bracket cell -->
 * <et-match-participant [participant]="match().away" compact showSeed />
 *
 * @example
 * <!-- a player card that navigates -->
 * <a [participant]="player()" [routerLink]="['/players', player().id]" et-match-participant showSeed></a>
 */
@Component({
  selector: 'et-match-participant, [et-match-participant]',
  template: `
    <span class="et-match-participant-emblem">
      @if (emblem(); as media) {
        <et-picture
          [sources]="media.sources ?? []"
          [defaultSrc]="media.defaultSrc ?? null"
          [alt]="emblemAlt()"
          class="et-match-participant-picture"
        />
      } @else if (loading()) {
        <et-skeleton-item class="et-match-participant-bone" shape="circle" />
      }
    </span>

    @if (loading() && !participant()) {
      <et-skeleton-item class="et-match-participant-name-bone" shape="text" />
    } @else {
      <span class="et-match-participant-names">
        <span [class.et-match-participant-name--tbd]="!participant()" class="et-match-participant-name">
          {{ displayName() }}
        </span>

        @if (subtitle(); as subtitle) {
          <span class="et-match-participant-subtitle">{{ subtitle }}</span>
        }
      </span>
    }

    @if (showSeed() && participant()?.seed !== null && participant()?.seed !== undefined) {
      <span [attr.aria-label]="seedLabel()" class="et-match-participant-seed">{{ participant()?.seed }}</span>
    }
  `,
  styleUrl: './match-participant.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [PICTURE_IMPORTS, SKELETON_IMPORTS],
  hostDirectives: [FocusRingDirective],
  host: {
    class: 'et-match-participant',
    '[attr.data-compact]': 'compact() ? "" : null',
    '[attr.data-tbd]': 'participant() ? null : ""',
    '[attr.data-interactive]': 'isInteractive() ? "" : null',
    // One name for the whole control, or the link reads its emblem's alt text and then the same name again.
    '[attr.aria-label]': 'isInteractive() ? displayName() : null',
  },
})
export class MatchParticipantComponent {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private injectedLabels = injectMatchLabels();

  /** The side to draw. `null` is a TBD slot — see the component's docs. */
  public participant = input<NormalizedMatchParticipant | null>(null);

  /** Prefer the short `code` over the full name, for a narrow column. @default false */
  public compact = input(false, { transform: booleanAttribute });

  /** Show the seeding position beside the name, when the participant has one. @default false */
  public showSeed = input(false, { transform: booleanAttribute });

  /**
   * Draw placeholders instead of an empty slot while the participant is still being fetched. Distinct
   * from a `null` participant, which is a decided *absence* — TBD — rather than a pending one.
   * @default false
   */
  public loading = input(false, { transform: booleanAttribute });

  /**
   * Whether this is a click target. `null` (the default) infers it from the host element, which is right
   * whenever it sits on an `<a>` or `<button>`. Set it for a host that is interactive some other way.
   */
  public interactive = input<boolean | null>(null);

  /** Override this instance's strings — see {@link provideMatchLabels} for the app-wide version. */
  public labels = input<Partial<MatchLabels> | null>(null);

  /** The strings in effect here: the injected label set with this instance's `labels` applied. */
  public resolvedLabels = computed<MatchLabels>(() => ({ ...this.injectedLabels(), ...this.labels() }));

  private readonly IS_NATIVELY_INTERACTIVE = ['A', 'BUTTON'].includes(this.elementRef.nativeElement.tagName);

  /** Whether this acts as a click target, and should therefore look and feel like one. */
  public isInteractive = computed(() => this.interactive() ?? this.IS_NATIVELY_INTERACTIVE);

  protected emblem = computed(() => this.participant()?.emblem ?? null);

  /**
   * The quieter second line, where there is one. Dropped in compact: the point of compact is that the
   * row fits a bracket column, and a second line is the first thing that stops fitting.
   */
  protected subtitle = computed(() => (this.compact() ? null : this.participant()?.subtitle) ?? null);

  /**
   * What this side is called, in one string — also what the card composes its accessible name from. The
   * fallback chain itself lives in {@link matchParticipantDisplayName}, so the card can reach the same
   * answer without a rendered participant to ask.
   */
  public displayName = computed(() =>
    matchParticipantDisplayName({
      participant: this.participant(),
      labels: this.resolvedLabels(),
      compact: this.compact(),
    }),
  );

  protected emblemAlt = computed(() => this.resolvedLabels().emblemAlt(this.displayName()));

  protected seedLabel = computed(() => {
    const seed = this.participant()?.seed;

    return seed === null || seed === undefined ? null : this.resolvedLabels().seed(seed);
  });
}
