import { RoundStageStructureWithMatchesView } from '@ethlete/types';
import '../../test-helpers';
import { queryAll } from '../testing/driver-core';
import { BRACKET_ERROR_CODES } from './bracket-errors';
import { resolveBracketLayout } from './bracket-layout';
import { provideBracketConfig } from './bracket.config';
import { TOURNAMENT_MODE } from './core/tournament';
import { generateBracketDataForEthlete } from './integrations/ethlete';
import {
  doubleEliminationBracketLayout,
  mirroredSingleEliminationBracketLayout,
  singleEliminationBracketLayout,
  swissBracketLayout,
} from './layouts';
import { BracketSwissStylesComponent } from './layouts/swiss/bracket-swiss-styles.component';
import { ET_DUMMY_DATA_SWISS } from './stories/dummy-data';
import { generateDoubleEliminationBracket } from './stories/generate-bracket';
import { bracketTestDriver } from './testing/bracket-driver';

const swissSource = () =>
  generateBracketDataForEthlete(ET_DUMMY_DATA_SWISS as unknown as RoundStageStructureWithMatchesView[]);

describe('resolveBracketLayout', () => {
  it('throws ET3413 for a mode nothing was registered for, naming the factory that fixes it', () => {
    expect(() =>
      resolveBracketLayout([singleEliminationBracketLayout()], TOURNAMENT_MODE.SWISS_WITH_ELIMINATION),
    ).toThrowError(/swissBracketLayout\(\)/);

    expect(() => resolveBracketLayout(undefined, TOURNAMENT_MODE.SWISS_WITH_ELIMINATION)).toThrowError(
      new RegExp(`ET${BRACKET_ERROR_CODES.LAYOUT_NOT_REGISTERED}.*swiss-with-elimination`),
    );
  });

  it('takes the first registered layout whose mode matches, so a mirrored entry can win', () => {
    const layout = resolveBracketLayout(
      [mirroredSingleEliminationBracketLayout(), singleEliminationBracketLayout()],
      TOURNAMENT_MODE.SINGLE_ELIMINATION,
    );

    expect(layout.dataLayout).toBe('mirrored');
    expect(layout.name).toBe('single-elimination-mirrored');
  });
});

describe('the layouts input', () => {
  it('replaces the provideBracketConfig list rather than adding to it', () => {
    const driver = bracketTestDriver({
      // Only single elimination app-wide - the double-elimination source below would throw on this alone.
      providers: [provideBracketConfig({ layouts: [singleEliminationBracketLayout()] })],
      source: generateDoubleEliminationBracket({ participantCount: 8, includeFinal: true }),
      layouts: [doubleEliminationBracketLayout()],
    });

    expect(queryAll(driver.fixture, '.et-bracket-element--match').length).toBeGreaterThan(0);
  });

  it('throws ET3413 when neither the input nor the config answers for the source', () => {
    expect(() =>
      bracketTestDriver({ source: generateDoubleEliminationBracket({ participantCount: 8, includeFinal: true }) }),
    ).toThrowError(new RegExp(`ET${BRACKET_ERROR_CODES.LAYOUT_NOT_REGISTERED}`));
  });
});

describe('swissBracketLayout', () => {
  it('mounts its group border styles while a swiss bracket renders', () => {
    bracketTestDriver({ source: swissSource(), layouts: [swissBracketLayout()] });

    // The mounted instance in the style manager's hidden container is what carries the group border CSS
    // into the document - asserting the `<style>` itself is not possible here, since the test build
    // strips component stylesheets.
    expect(document.querySelector('.et-style-manager et-bracket-swiss-styles')).toBeTruthy();
    expect(swissBracketLayout().styles).toContain(BracketSwissStylesComponent);
  });

  it('draws no swiss styles for an elimination bracket', () => {
    bracketTestDriver({
      source: generateDoubleEliminationBracket({ participantCount: 8, includeFinal: true }),
      layouts: [doubleEliminationBracketLayout()],
    });

    expect(document.querySelector('et-bracket-swiss-styles')).toBeNull();
  });
});
