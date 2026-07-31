import { booleanAttribute, Component, computed, input, ViewEncapsulation } from '@angular/core';
import { PICTURE_IMPORTS } from '../picture';
import { SKELETON_IMPORTS } from '../skeleton';
import { injectMatchLabels, MatchLabels } from './match-labels';
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
 * @example
 * <et-match-participant [participant]="match().home" />
 *
 * @example
 * <!-- a bracket cell -->
 * <et-match-participant [participant]="match().away" compact showSeed />
 */
@Component({
  selector: 'et-match-participant',
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
      <span [class.et-match-participant-name--tbd]="!participant()" class="et-match-participant-name">
        {{ displayName() }}
      </span>
    }

    @if (showSeed() && participant()?.seed !== null && participant()?.seed !== undefined) {
      <span [attr.aria-label]="seedLabel()" class="et-match-participant-seed">{{ participant()?.seed }}</span>
    }
  `,
  styleUrl: './match-participant.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [PICTURE_IMPORTS, SKELETON_IMPORTS],
  host: {
    class: 'et-match-participant',
    '[attr.data-compact]': 'compact() ? "" : null',
    '[attr.data-tbd]': 'participant() ? null : ""',
  },
})
export class MatchParticipantComponent {
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

  /** Override this instance's strings — see {@link provideMatchLabels} for the app-wide version. */
  public labels = input<Partial<MatchLabels> | null>(null);

  /** The strings in effect here: the injected label set with this instance's `labels` applied. */
  public resolvedLabels = computed<MatchLabels>(() => ({ ...this.injectedLabels(), ...this.labels() }));

  protected emblem = computed(() => this.participant()?.emblem ?? null);

  /**
   * What this side is called, in one string — also what the card composes its accessible name from.
   * Compact prefers the code and falls back to the name, because a participant with no code still has
   * to be readable in a narrow column.
   */
  public displayName = computed(() => {
    const participant = this.participant();

    if (!participant) return this.resolvedLabels().tbd;

    const name = this.compact() ? (participant.code ?? participant.name) : (participant.name ?? participant.code);

    return name ?? this.resolvedLabels().tbd;
  });

  protected emblemAlt = computed(() => this.resolvedLabels().emblemAlt(this.displayName()));

  protected seedLabel = computed(() => {
    const seed = this.participant()?.seed;

    return seed === null || seed === undefined ? null : this.resolvedLabels().seed(seed);
  });
}
