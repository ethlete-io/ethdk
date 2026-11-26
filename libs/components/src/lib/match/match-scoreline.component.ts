import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { MatchScoreComponent } from './match-score.component';
import { MatchTimeComponent } from './match-time.component';

/**
 * The centre of a match row: `home : away` with the start time under it. Use it between two
 * `et-match-participant`s where a card's own layout is not wanted, e.g. an editor.
 *
 * A missing score draws `-`. The row has no accessible name of its own: put an `aria-label` on it when
 * it is the only place the result appears.
 *
 * @example
 * <et-match-scoreline [homeScore]="match.homeScore" [awayScore]="match.awayScore" time="18:30" />
 */
@Component({
  selector: 'et-match-scoreline',
  template: `
    <span class="et-match-scoreline-scores">
      <et-match-score [value]="homeText()" [animate]="animate()" [subject]="subject()" />
      <span class="et-match-scoreline-separator" aria-hidden="true">{{ separator() }}</span>
      <et-match-score [value]="awayText()" [animate]="animate()" [subject]="subject()" />
    </span>

    @if (time(); as timeText) {
      <et-match-time class="et-match-scoreline-time">{{ timeText }}</et-match-time>
    }
  `,
  styleUrl: './match-scoreline.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [MatchScoreComponent, MatchTimeComponent],
  host: { class: 'et-match-scoreline' },
})
export class MatchScorelineComponent {
  /** The home value. `null` draws `-`. */
  public homeScore = input<string | number | null>(null);

  /** The away value. `null` draws `-`. */
  public awayScore = input<string | number | null>(null);

  /** The text between the two values. @default ':' */
  public separator = input(':');

  /** The already formatted start time. `null` draws none. */
  public time = input<string | null>(null);

  /** Roll a value when it changes - see `et-match-score`. @default false */
  public animate = input(false);

  /** What the values belong to, e.g. a match id. */
  public subject = input<unknown>(null);

  protected homeText = computed(() => this.homeScore()?.toString() ?? '-');

  protected awayText = computed(() => this.awayScore()?.toString() ?? '-');
}
