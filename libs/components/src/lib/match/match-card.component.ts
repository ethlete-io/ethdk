import { Component, computed, inject, input, ViewEncapsulation } from '@angular/core';
import { ColorTheme, injectColorThemes, ProvideColorDirective, RegisteredColorThemeName } from '@ethlete/core';
import { FocusRingDirective } from '../focus-ring';
import {
  MatchCardDirective,
  MatchCardGameScoresDirective,
  MatchCardMetaDirective,
  MatchCardScoreDirective,
} from './headless';
import { MatchParticipantComponent } from './match-participant.component';
import { MatchScoreComponent } from './match-score.component';

/**
 * The default match card: both sides with their emblems, the score or the kick-off, the per-game
 * breakdown of a series, a live badge, and the winner emphasized once there is one. Driven by the
 * headless {@link MatchCardDirective}.
 *
 * **One card, three layouts.** It measures itself with a container query: under 320px the dense row a
 * bracket column or a list needs, above it the featured card with big emblems and the game-score
 * breakdown, and from 560px the wide row where the two sides face each other across the middle. Same
 * DOM throughout; set `size` to pin one.
 *
 * **Make the host the link.** The card's whole accessible name lands on its host element, so putting the
 * card on an `<a>` gives you one correctly named link and nothing to fix:
 *
 * @example
 * <a [match]="match()" [routerLink]="['/matches', match().id]" et-match-card></a>
 *
 * @example
 * <!-- non-interactive, e.g. a results table -->
 * <et-match-card [match]="match()" size="compact" />
 */
@Component({
  selector: 'et-match-card, [et-match-card]',
  templateUrl: './match-card.component.html',
  styleUrl: './match-card.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    MatchParticipantComponent,
    MatchScoreComponent,
    MatchCardMetaDirective,
    MatchCardScoreDirective,
    MatchCardGameScoresDirective,
    ProvideColorDirective,
  ],
  hostDirectives: [
    {
      directive: MatchCardDirective,
      inputs: [
        'match',
        'size',
        'showSeeds',
        'hideNames',
        'startTimeFormat',
        'interactive',
        'labels',
        'animateScoreChanges',
      ],
      outputs: ['scoreChange'],
    },
    FocusRingDirective,
  ],
  host: {
    class: 'et-match-card',
  },
})
export class MatchCardComponent {
  protected card = inject(MatchCardDirective);

  private colorThemes = injectColorThemes({ optional: true });

  /**
   * The color theme the live badge is drawn in. `null` (the default) uses the app's `type: 'error'`
   * theme, which is the red a live badge is expected to be - and falls through to the ambient color
   * scope in an app that registered none. Theme names are the app's own, so this takes one of them (or
   * the theme object).
   */
  public liveColor = input<RegisteredColorThemeName | ColorTheme | null>(null);

  protected liveColorTheme = computed<RegisteredColorThemeName | ColorTheme | null>(
    () => this.liveColor() ?? this.colorThemes?.find((theme) => theme.type === 'error') ?? null,
  );
}
