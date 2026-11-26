import { booleanAttribute, Component, computed, input, output, ViewEncapsulation } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ColorThemeInput, createComponentId, ProvideColorDirective, mountVisuallyHidden } from '@ethlete/core';
import { FocusRingDirective } from '../focus-ring';
import { injectOptionalSemanticTheme } from '../internals/semantic-theme';
import {
  injectMatchLabels,
  MatchParticipantComponent,
  matchParticipantDisplayName,
  NormalizedMatch,
  resolveNormalizedMatchSideState,
} from '../match';
import { describeBracketSlot, injectBracketLabels } from './bracket-labels';
import { MatchParticipantSide, BracketMatch } from '@ethlete/bracket';

/** How the card's note line reads. */
export const BRACKET_PICK_CARD_NOTE_TONE = {
  /** A remark: quiet text under the card, nothing else changes. */
  MUTED: 'muted',
  /** Something is wrong with the pick on this card - the card is outlined as well. */
  INVALID: 'invalid',
} as const;

export type BracketPickCardNoteTone = (typeof BRACKET_PICK_CARD_NOTE_TONE)[keyof typeof BRACKET_PICK_CARD_NOTE_TONE];

/**
 * One bracket match as a cell the viewer picks a winner in. Bind the linked `bracketMatch`, your
 * `normalized` view of it and the `pickedSide` you hold; write `(pick)` back to your own state.
 *
 * Both sides have to be resolved before either becomes a control, so a partial matchup, a bye, and a
 * side no pick reaches are non-focusable text rather than a dead button. Three separate things stop a
 * pick, and they are not interchangeable: `locked` (the deadline passed - the picks stay visible and
 * stop changing), `disabled` (this viewer may not pick here at all) and `readonly` (a results view,
 * where the side the match decided against reads as the loser).
 *
 * @example
 * <et-bracket-pick-card
 *   [bracketMatch]="bracketMatch()"
 *   [normalized]="normalized()"
 *   [pickedSide]="pickedSide()"
 *   [note]="note()"
 *   (pick)="savePick($event)"
 * />
 */
@Component({
  selector: 'et-bracket-pick-card',
  templateUrl: './bracket-pick-card.component.html',
  styleUrl: './bracket-pick-card.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [FocusRingDirective, MatchParticipantComponent, NgTemplateOutlet, ProvideColorDirective],
  host: {
    class: 'et-bracket-pick-card',
    '[attr.data-locked]': 'locked() ? "" : null',
    '[attr.data-disabled]': 'disabled() ? "" : null',
    '[attr.data-readonly]': 'readonly() ? "" : null',
    '[attr.data-note-tone]': 'note() ? noteTone() : null',
  },
})
export class BracketPickCardComponent<TRoundData = unknown, TMatchData = unknown> {
  private labels = injectBracketLabels();
  private matchLabels = injectMatchLabels();
  private errorColorTheme = injectOptionalSemanticTheme('error');

  public bracketMatch = input.required<BracketMatch<TRoundData, TMatchData>>();
  public normalized = input.required<NormalizedMatch>();

  /** Which side the viewer picked, or `null` for no pick yet. */
  public pickedSide = input<MatchParticipantSide | null>(null);

  /** The deadline for this match has passed: the pick stays visible and stops being changeable. */
  public locked = input(false, { transform: booleanAttribute });

  /** This viewer may not pick here at all - not signed in, not entered, not their bracket. */
  public disabled = input(false, { transform: booleanAttribute });

  /**
   * A results view rather than a second way to pick: nothing is selectable, no pick marks are drawn,
   * and once the match is decided the side it decided against is dimmed.
   */
  public readonly = input(false, { transform: booleanAttribute });

  /**
   * No earlier round is left to predict, so a side no pick of this viewer reaches states that rather
   * than inviting a prediction that can no longer be made.
   */
  public earlierRoundsClosed = input(false, { transform: booleanAttribute });

  /** Overrides the `pickCardPredicted` label for this card. */
  public predictedLabel = input<string | null>(null);

  /**
   * One line drawn under the card, outside its box, so it never takes height from the card. What it
   * should say is the app's call - a lock, a stale pick, a pick that followed its participant here.
   */
  public note = input<string | null>(null);

  /** How the `note` reads - see {@link BRACKET_PICK_CARD_NOTE_TONE}. @default 'muted' */
  public noteTone = input<BracketPickCardNoteTone>(BRACKET_PICK_CARD_NOTE_TONE.MUTED);

  public pick = output<MatchParticipantSide>();

  protected readonly NOTE_ID = createComponentId('et-bracket-pick-card-note');

  protected pickedLabel = computed(() => this.labels().pickCardPicked);
  protected resolvedPredictedLabel = computed(() => this.predictedLabel() ?? this.labels().pickCardPredicted);

  protected noteColorTheme = computed<ColorThemeInput>(() =>
    this.noteTone() === BRACKET_PICK_CARD_NOTE_TONE.INVALID ? this.errorColorTheme() : null,
  );

  protected sides = computed(() => {
    const bracketMatch = this.bracketMatch();
    const normalized = this.normalized();
    const labels = this.labels();
    const matchLabels = this.matchLabels();
    const predictedLabel = this.resolvedPredictedLabel();
    const isReadonly = this.readonly();
    const decidedSide = normalized.winnerSide;
    const sideItems = (['home', 'away'] as const).map((side) => {
      const state = resolveNormalizedMatchSideState(normalized, side);
      const source = side === 'home' ? bracketMatch.homeSource : bracketMatch.awaySource;

      return { side, state, source, participant: normalized[side] };
    });
    const matchIsSelectable = sideItems.every(
      ({ participant, source, state }) =>
        participant !== null && (state === 'occupied' || state === 'predicted') && source?.kind !== 'bye',
    );

    return sideItems.map(({ side, state, source, participant }) => {
      const selected = this.pickedSide() === side;
      const selectable = matchIsSelectable && !this.locked() && !this.disabled() && !isReadonly;

      const name = matchParticipantDisplayName({ participant, labels: matchLabels, compact: true });

      return {
        side,
        state,
        participant,
        accessibleName: state === 'predicted' ? `${name}, ${predictedLabel}` : name,
        selected,
        selectable,
        showMark: !isReadonly && (selectable || selected),
        dimmed: isReadonly && decidedSide !== null && decidedSide !== side,
        emptyLabel:
          state === 'unresolvable'
            ? this.earlierRoundsClosed()
              ? labels.slotNotPredicted
              : labels.slotPredictEarlierRound
            : describeBracketSlot(source, labels),
      };
    });
  });

  constructor() {
    mountVisuallyHidden();
  }
}
