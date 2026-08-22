import '../../test-helpers';
import { BracketDataSource } from './integrations';
import { bracketTestDriver, testBracketLayouts } from './testing/bracket-driver';
import { generateSingleEliminationBracket } from './stories/generate-bracket';

/**
 * The same bracket with its opening two matches swapped - a re-seeding a live feed can ship, and one
 * that moves a journey without moving the `p<n>` short id the grid marks its cells with.
 */
const reseededOpeningRound = (source: BracketDataSource<null, null>): BracketDataSource<null, null> => {
  const [first, second] = source.matches;

  if (!first || !second) throw new Error('expected at least two matches in the opening round');

  return {
    ...source,
    matches: source.matches.map((match) => {
      if (match.id === first.id) return { ...match, home: second.home, away: second.away };
      if (match.id === second.id) return { ...match, home: first.home, away: first.away };

      return match;
    }),
  };
};

describe('BracketComponent participant focus', () => {
  let driver: ReturnType<typeof bracketTestDriver>;

  beforeEach(() => {
    driver = bracketTestDriver({ source: generateSingleEliminationBracket(8), layouts: testBracketLayouts });
  });

  it('marks every cell of a pinned participant, and says so on the host', () => {
    // `p1` is the generator's top seed, who wins out - three matches, one per round.
    driver.pin('p1');

    expect(driver.element().classList).toContain('et-bracket-host--journey-hover');
    expect(driver.element().classList).toContain('et-bracket-host--journey-focused');
    expect(driver.activeMatchIds()).toEqual(['se-r0-m0', 'se-r1-m0', 'se-r2-m0']);
  });

  it('leaves the final card to measure its own cell', () => {
    expect(driver.element().querySelector('.et-bracket-final-card')?.getAttribute('data-size')).toBe('auto');
  });

  it('crosses out the row a participant went out in', () => {
    driver.pin('p2');

    const endpoint = driver.element().querySelector('.et-bracket-journey-endpoint');

    expect(endpoint?.getAttribute('data-match-id')).toBe('se-r0-m0');
    expect(driver.element().querySelector('.et-bracket-journey-eliminated')?.getAttribute('data-participant-id')).toBe(
      'p2',
    );
  });

  it('drops the pin on Escape and writes the null back through the model', () => {
    driver.pin('p1');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    driver.detectChanges();

    expect(driver.host.focusedParticipantId()).toBeNull();
    expect(driver.element().classList).not.toContain('et-bracket-host--journey-focused');
  });

  it('leaves the pin alone for any other key', () => {
    driver.pin('p1');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    driver.detectChanges();

    expect(driver.host.focusedParticipantId()).toBe('p1');
  });

  it('drops the pin when a click lands past the cells', () => {
    driver.pin('p1');

    driver.element().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    driver.detectChanges();

    expect(driver.host.focusedParticipantId()).toBeNull();
  });

  it('keeps the pin when the click was the card doing its job', () => {
    driver.pin('p1');

    const cell = driver.cellFor('se-r1-m0');

    expect(cell).not.toBeNull();
    cell?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    driver.detectChanges();

    expect(driver.host.focusedParticipantId()).toBe('p1');
  });

  it('re-marks a pinned journey against the cells of a new source', () => {
    driver.pin('p1');

    driver.host.source.set(generateSingleEliminationBracket(16));
    driver.detectChanges();

    expect(driver.activeMatchIds()).toEqual(['se-r0-m0', 'se-r1-m0', 'se-r2-m0', 'se-r3-m0']);
  });

  it('lights a pin that only the new source knows, and dims nothing until then', () => {
    driver.pin('p9');

    expect(driver.activeMatchIds()).toEqual([]);
    expect(driver.element().classList).not.toContain('et-bracket-host--journey-focused');

    driver.host.source.set(generateSingleEliminationBracket(16));
    driver.detectChanges();

    expect(driver.activeMatchIds()).toEqual(['se-r0-m4', 'se-r1-m2', 'se-r2-m1', 'se-r3-m0']);
    expect(driver.element().classList).toContain('et-bracket-host--journey-focused');
  });

  it('stops marking a participant the new source dropped', () => {
    driver.host.source.set(generateSingleEliminationBracket(16));
    driver.detectChanges();

    driver.pin('p9');

    expect(driver.activeMatchIds()).toEqual(['se-r0-m4', 'se-r1-m2', 'se-r2-m1', 'se-r3-m0']);

    driver.host.source.set(generateSingleEliminationBracket(8));
    driver.detectChanges();

    expect(driver.activeMatchIds()).toEqual([]);
    expect(driver.element().classList).not.toContain('et-bracket-host--journey-hover');
  });

  it('re-marks a journey whose cells moved under an unchanged short id', () => {
    driver.pin('p1');

    driver.host.source.set(reseededOpeningRound(generateSingleEliminationBracket(8)));
    driver.detectChanges();

    expect(driver.activeMatchIds()).toEqual(['se-r0-m1', 'se-r1-m0', 'se-r2-m0']);
  });

  it('draws nothing once the journey highlight is off', () => {
    const disabled = bracketTestDriver({
      source: generateSingleEliminationBracket(8),
      layouts: testBracketLayouts,
      focusedParticipantId: 'p1',
      disableJourneyHighlight: true,
    });

    expect(disabled.activeMatchIds()).toEqual([]);
  });
});
