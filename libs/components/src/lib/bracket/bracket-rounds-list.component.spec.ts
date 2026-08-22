import { Component, input } from '@angular/core';
import '../../test-helpers';
import { query, queryAll, textOf } from '../testing/driver-core';
import { provideBracketLabels } from './bracket-labels';
import { bracketFitsWidth, bracketNaturalWidth } from './bracket-fits-width';
import { BracketMatch, BracketRound, BracketRoundSwissGroup } from './linked';
import { bracketTestDriver, testBracketLayouts } from './testing/bracket-driver';
import { generateDoubleEliminationBracket, generateSingleEliminationBracket } from './stories/generate-bracket';

/** Stands in for a consumer's own cell, to prove the overrides reach the list. */
@Component({
  selector: 'et-test-match',
  template: `<span class="test-match">{{ bracketMatch().id }}</span>`,
})
class TestMatchComponent {
  public bracketRound = input.required<BracketRound<unknown, unknown>>();
  public bracketMatch = input.required<BracketMatch<unknown, unknown>>();
  public bracketRoundSwissGroup = input.required<BracketRoundSwissGroup<unknown, unknown> | null>();
}

describe('BracketRoundsListComponent', () => {
  let driver: ReturnType<typeof bracketTestDriver>;

  const roundNames = () => queryAll(driver.fixture, '.et-bracket-default-round-header-name').map(textOf);
  const matchCount = () => queryAll(driver.fixture, '.et-bracket-rounds-list-match').length;

  beforeEach(() => {
    driver = bracketTestDriver({
      component: 'rounds-list',
      source: generateSingleEliminationBracket(8),
      layouts: testBracketLayouts,
    });
  });

  it('renders every round of a single-elimination source in one unnamed section', () => {
    expect(driver.sections()).toEqual([{ id: 'all', name: null }]);
    expect(roundNames()).toEqual(['Round 1', 'Round 2', 'Final']);
    expect(matchCount()).toBe(7);
  });

  it('draws the deciding round with the final card', () => {
    expect(queryAll(driver.fixture, '.et-bracket-final-host').length).toBe(1);
  });

  it('splits a double-elimination source into upper, lower and finals sections', () => {
    driver.host.source.set(generateDoubleEliminationBracket({ participantCount: 8, includeFinal: true }));
    driver.detectChanges();

    expect(driver.sections()).toEqual([
      { id: 'upper', name: 'Upper bracket' },
      { id: 'lower', name: 'Lower bracket' },
      { id: 'finals', name: 'Finals' },
    ]);
  });

  it('gives the bracket-reset final the final card, not the grand final', () => {
    driver.host.source.set(generateDoubleEliminationBracket({ participantCount: 8, includeFinal: true }));
    driver.detectChanges();

    const finalCards = queryAll(driver.fixture, '.et-bracket-final-host');

    expect(finalCards.length).toBe(1);
    expect(finalCards[0]?.textContent).toContain('Bracket reset');
  });

  it('pins the final card so a wide list cannot flip it to the side-by-side arrangement', () => {
    // A list row is as wide as the page; only the grid, whose cells have a chosen width, leaves this open.
    expect(query(driver.fixture, '.et-bracket-final-card')?.getAttribute('data-size')).toBe('expanded');
  });

  it('narrows to a single round when selectedRoundId is set', () => {
    driver.host.selectedRoundId.set('se-r1');
    driver.detectChanges();

    expect(roundNames()).toEqual(['Round 2']);
    expect(matchCount()).toBe(2);
  });

  it('renders a matchComponent of your own instead of the default card', () => {
    driver.host.matchComponent.set(TestMatchComponent);
    driver.detectChanges();

    // The final keeps its own card - only the ordinary cells were overridden.
    expect(queryAll(driver.fixture, '.test-match').length).toBe(6);
  });

  it('localizes the section headings', () => {
    driver = bracketTestDriver({
      component: 'rounds-list',
      source: generateDoubleEliminationBracket({ participantCount: 8 }),
      layouts: testBracketLayouts,
      providers: [provideBracketLabels({ upperBracketSection: 'Oberes Bracket' })],
    });

    expect(query(driver.fixture, '.et-bracket-rounds-list-section-name')?.textContent).toContain('Oberes Bracket');
  });
});

describe('bracketNaturalWidth', () => {
  it('measures a bracket the way the grid lays it out', () => {
    const source = generateSingleEliminationBracket(8);

    // 2 ordinary columns + the wider final column + 2 gaps.
    expect(
      bracketNaturalWidth(source, {
        layouts: testBracketLayouts,
        columnWidth: 200,
        finalColumnWidth: 300,
        columnGap: 50,
      }),
    ).toBe(800);
  });

  it('grows with the column width', () => {
    const source = generateSingleEliminationBracket(8);

    expect(bracketNaturalWidth(source, { layouts: testBracketLayouts, columnWidth: 300 })).toBeGreaterThan(
      bracketNaturalWidth(source, { layouts: testBracketLayouts, columnWidth: 200 }),
    );
  });

  it('draws narrower at compact density', () => {
    const source = generateSingleEliminationBracket(8);

    expect(bracketNaturalWidth(source, { layouts: testBracketLayouts, density: 'compact' })).toBeLessThan(
      bracketNaturalWidth(source, { layouts: testBracketLayouts }),
    );
  });

  it('lets an explicit setting win over the density preset', () => {
    const source = generateSingleEliminationBracket(8);

    // Two 400px columns and the preset's 200px final, with the preset's 32px gaps.
    expect(bracketNaturalWidth(source, { layouts: testBracketLayouts, density: 'compact', columnWidth: 400 })).toBe(
      1064,
    );
  });

  it('needs more room for a double-elimination source than a single-elimination one', () => {
    expect(
      bracketNaturalWidth(generateDoubleEliminationBracket({ participantCount: 8 }), { layouts: testBracketLayouts }),
    ).toBeGreaterThan(bracketNaturalWidth(generateSingleEliminationBracket(8), { layouts: testBracketLayouts }));
  });

  it('throws ET3413 when no layout is registered for the source', () => {
    expect(() => bracketNaturalWidth(generateSingleEliminationBracket(8))).toThrow(/ET3413/);
  });
});

describe('bracketFitsWidth', () => {
  const source = generateSingleEliminationBracket(8);
  const config = { layouts: testBracketLayouts, columnWidth: 200, finalColumnWidth: 300, columnGap: 50 };

  it('fits at exactly its natural width', () => {
    expect(bracketFitsWidth(source, config, 800)).toBe(true);
  });

  it('does not fit one pixel below it', () => {
    expect(bracketFitsWidth(source, config, 799)).toBe(false);
  });
});
