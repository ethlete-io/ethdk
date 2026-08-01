import { afterNextRender, computed, Directive, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { MATCH_ERROR_CODES } from '../match-errors';
import { MATCH_CARD_TOKEN } from './match-card.tokens';

/**
 * Every part reads its state off the card it sits in, so one outside a card is a template mistake rather
 * than a degraded card. Checked after render, since the parent registers during construction.
 */
const assertInsideMatchCard = (card: unknown, selector: string) => {
  if (card) return;

  throw new RuntimeError(
    MATCH_ERROR_CODES.PART_OUTSIDE_MATCH_CARD,
    `[${selector}] ${selector} must be placed inside an [etMatchCard] element (e.g. <et-match-card>).`,
  );
};

/**
 * Marks the element that announces the score. It is a polite, atomic live region, so a score arriving
 * over a poll or a socket is read as one value (`"2 : 1"`) rather than digit by digit - and only when it
 * changes, never on first render.
 *
 * The default card puts this on a visually hidden element and hides the drawn digits from assistive tech,
 * which is what keeps the score from being read three times over.
 */
@Directive({
  selector: '[etMatchCardScore]',
  exportAs: 'etMatchCardScore',
  host: {
    'aria-live': 'polite',
    'aria-atomic': 'true',
  },
})
export class MatchCardScoreDirective {
  private card = inject(MATCH_CARD_TOKEN, { optional: true });

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => assertInsideMatchCard(this.card, 'etMatchCardScore'));
    }
  }
}

/**
 * Marks the row that carries the match's label, its live badge and its kick-off. Hidden from assistive
 * tech: all three are already in the card's composed accessible name, and reading them again as loose
 * fragments is what makes a list of these unbearable to listen to.
 */
@Directive({
  selector: '[etMatchCardMeta]',
  exportAs: 'etMatchCardMeta',
  host: {
    'aria-hidden': 'true',
  },
})
export class MatchCardMetaDirective {
  private card = inject(MATCH_CARD_TOKEN, { optional: true });

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => assertInsideMatchCard(this.card, 'etMatchCardMeta'));
    }
  }
}

/**
 * Marks the per-game breakdown of a series (Bo3/Bo5) and names it from the `gameScores` label. The
 * explicit `role="list"` is not redundant: a list whose `list-style` is removed loses its role in Safari,
 * and this one is always styled.
 */
@Directive({
  selector: '[etMatchCardGameScores]',
  exportAs: 'etMatchCardGameScores',
  host: {
    role: 'list',
    '[attr.aria-label]': 'ariaLabel()',
  },
})
export class MatchCardGameScoresDirective {
  private card = inject(MATCH_CARD_TOKEN, { optional: true });

  protected ariaLabel = computed(() => this.card?.resolvedLabels().gameScores ?? null);

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => assertInsideMatchCard(this.card, 'etMatchCardGameScores'));
    }
  }
}
