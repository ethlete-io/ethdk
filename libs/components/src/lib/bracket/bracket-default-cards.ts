import { BracketDefaultContinueComponent } from './bracket-default-continue.component';
import { BracketDefaultFinalMatchComponent } from './bracket-default-final-match.component';
import { BracketDefaultMatchComponent } from './bracket-default-match.component';
import { BracketDefaultRoundHeaderComponent } from './bracket-default-round-header.component';
import { BracketConfig } from './bracket.config';

/**
 * The shipped cards, to spread into `provideBracketConfig`. An app that draws only cards of its own
 * leaves this out and bundles none of them.
 *
 * @example
 * provideBracketConfig({ layouts: [singleEliminationBracketLayout()], ...BRACKET_DEFAULT_CARDS });
 */
export const BRACKET_DEFAULT_CARDS = {
  roundHeaderComponent: BracketDefaultRoundHeaderComponent,
  matchComponent: BracketDefaultMatchComponent,
  finalMatchComponent: BracketDefaultFinalMatchComponent,
  continueComponent: BracketDefaultContinueComponent,
} satisfies Partial<BracketConfig>;
