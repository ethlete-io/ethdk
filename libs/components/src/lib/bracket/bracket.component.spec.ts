import '../../test-helpers';
import { queryAll } from '../testing/driver-core';
import { COMMON_BRACKET_ROUND_TYPE } from './core';
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

/** The same bracket with a third place round hanging off the semi finals. */
const withThirdPlace = (source: BracketDataSource<null, null>): BracketDataSource<null, null> => {
  const semiFinal = source.rounds[source.rounds.length - 2];

  if (!semiFinal) throw new Error('expected a semi final round');

  return {
    ...source,
    rounds: [
      ...source.rounds,
      { id: 'third-place', type: COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE, name: 'Third place', data: null },
    ],
    matches: [
      ...source.matches,
      {
        id: 'third-place-m0',
        roundId: 'third-place',
        home: 'p2',
        away: 'p4',
        winner: 'home',
        status: 'completed',
        data: null,
      },
    ],
  };
};

describe('BracketComponent focused rounds', () => {
  it('keeps a tall final below its header when a later round sets the row span', () => {
    const driver = bracketTestDriver({
      source: generateSingleEliminationBracket(8),
      layouts: testBracketLayouts,
      rowSpanRoundId: 'se-r2',
    });

    expect(driver.positionOf('se-r2-m0').y).toBeGreaterThanOrEqual(70);
  });

  it('moves the focused round to the inline start', () => {
    const driver = bracketTestDriver({
      source: generateSingleEliminationBracket(8),
      layouts: testBracketLayouts,
      focusRoundId: 'se-r1',
    });
    const bracket = driver.element().querySelector<HTMLElement>('.et-bracket');

    expect(bracket?.style.transform).toBe('translateX(-310px)');
  });

  it('keeps focusInset px to the start of the focused round', () => {
    const driver = bracketTestDriver({
      source: generateSingleEliminationBracket(8),
      layouts: testBracketLayouts,
      focusRoundId: 'se-r1',
      focusInset: 40,
    });
    const bracket = driver.element().querySelector<HTMLElement>('.et-bracket');

    expect(bracket?.style.transform).toBe('translateX(-270px)');
  });

  it('keeps the whole bracket where it was while no round is focused', () => {
    const driver = bracketTestDriver({
      source: generateSingleEliminationBracket(8),
      layouts: testBracketLayouts,
      focusInset: 40,
    });
    const bracket = driver.element().querySelector<HTMLElement>('.et-bracket');

    expect(bracket?.style.transform).toBe('translateX(0px)');
  });
});

describe('BracketComponent cells', () => {
  it('positions a cell with a transform, so a squeeze needs no layout', () => {
    const driver = bracketTestDriver({ source: generateSingleEliminationBracket(8), layouts: testBracketLayouts });
    const cell = driver.cellFor('se-r1-m0');
    const round = cell?.closest<HTMLElement>('.et-bracket-round');

    expect(cell?.style.transform).toMatch(/^translate\(-?[\d.]+px, -?[\d.]+px\)$/);
    expect(round?.style.transform).toMatch(/^translate\(-?[\d.]+px, -?[\d.]+px\)$/);
    expect(cell?.style.top).toBe('');
    expect(cell?.style.left).toBe('');
    expect(round?.style.top).toBe('');
    expect(round?.style.left).toBe('');
  });

  it('moves a cell without changing which element holds it when the row span changes', () => {
    const driver = bracketTestDriver({ source: generateSingleEliminationBracket(8), layouts: testBracketLayouts });
    const cell = driver.cellFor('se-r2-m0');
    const before = driver.positionOf('se-r2-m0');

    driver.host.rowSpanRoundId.set('se-r2');
    driver.detectChanges();

    expect(driver.positionOf('se-r2-m0').y).not.toBe(before.y);
    expect(driver.cellFor('se-r2-m0')).toBe(cell);
  });
});

describe('BracketComponent connectors', () => {
  let driver: ReturnType<typeof bracketTestDriver>;

  beforeEach(() => {
    driver = bracketTestDriver({ source: generateSingleEliminationBracket(8), layouts: testBracketLayouts });
  });

  it('draws each connector as its own path, with a CSS path beside the attribute', () => {
    const paths = queryAll(driver.fixture, '.et-bracket-svg path');

    expect(paths.length).toBe(6);
    expect(paths.every((path) => path.getAttribute('d')?.startsWith('M '))).toBe(true);
    expect(driver.element().querySelector('.et-bracket-svg')?.innerHTML).not.toContain('&lt;');
  });

  it('re-uses the same path nodes when the rows are squeezed', () => {
    const before = queryAll(driver.fixture, '.et-bracket-svg path');
    const shapeBefore = before.map((path) => (path.getAttribute('d')?.match(/[A-Za-z]/g) ?? []).join(''));

    driver.host.rowSpanRoundId.set('se-r2');
    driver.detectChanges();

    const after = queryAll(driver.fixture, '.et-bracket-svg path');

    expect(after).toEqual(before);
    expect(after.map((path) => (path.getAttribute('d')?.match(/[A-Za-z]/g) ?? []).join(''))).toEqual(shapeBefore);
  });

  it('lights the connectors of a pinned journey', () => {
    driver.pin('p1');

    expect(driver.edges().filter((edge) => edge.classes.includes('et-bracket-journey-active')).length).toBe(2);
  });
});

describe('BracketComponent round headers', () => {
  it('says how a header is aligned over its column', () => {
    const driver = bracketTestDriver({ source: generateSingleEliminationBracket(8), layouts: testBracketLayouts });

    expect(driver.headerCells().map((header) => header.getAttribute('data-align'))).toEqual([
      'start',
      'start',
      'start',
    ]);

    driver.host.alignRoundHeaders.set('center');
    driver.detectChanges();

    expect(driver.headerCells().every((header) => header.getAttribute('data-align') === 'center')).toBe(true);
  });

  it('leaves every other round where it was when the final asks for more header room', () => {
    const driver = bracketTestDriver({ source: generateSingleEliminationBracket(8), layouts: testBracketLayouts });
    const firstRound = driver.positionOf('se-r0-m0').y;
    const final = driver.positionOf('se-r2-m0').y;

    driver.host.finalRoundHeaderGap.set(60);
    driver.detectChanges();

    expect(driver.positionOf('se-r0-m0').y).toBe(firstRound);
    expect(driver.positionOf('se-r2-m0').y).toBe(final + 40);
  });

  it('ignores a final header gap narrower than the shared one', () => {
    const driver = bracketTestDriver({
      source: generateSingleEliminationBracket(8),
      layouts: testBracketLayouts,
      finalRoundHeaderGap: 5,
    });
    const relaxed = bracketTestDriver({ source: generateSingleEliminationBracket(8), layouts: testBracketLayouts });

    expect(driver.positionOf('se-r2-m0')).toEqual(relaxed.positionOf('se-r2-m0'));
  });
});

describe('BracketComponent third place', () => {
  const source = () => withThirdPlace(generateSingleEliminationBracket(8));

  it('gives the third place a column of its own by default', () => {
    const driver = bracketTestDriver({ source: source(), layouts: testBracketLayouts });

    expect(driver.positionOf('third-place-m0').x).toBeGreaterThan(driver.positionOf('se-r2-m0').x);
  });

  it('folds the third place under the final, that many px below its card', () => {
    const driver = bracketTestDriver({ source: source(), layouts: testBracketLayouts, thirdPlaceTopOffset: 240 });
    const final = driver.positionOf('se-r2-m0');
    const thirdPlace = driver.positionOf('third-place-m0');

    expect(thirdPlace.x).toBe(final.x);
    expect(thirdPlace.y).toBe(final.y + 240);
  });

  it('moves the folded round header above its own card', () => {
    const driver = bracketTestDriver({ source: source(), layouts: testBracketLayouts, thirdPlaceTopOffset: 240 });
    const thirdPlace = driver.positionOf('third-place-m0');
    const header = driver.headerCells().at(-1);
    const round = header?.closest<HTMLElement>('.et-bracket-round');
    const headerTop =
      Number.parseFloat(/translate\(-?[\d.]+px, (-?[\d.]+)px\)/.exec(header?.style.transform ?? '')?.[1] ?? '0') +
      Number.parseFloat(/translate\(-?[\d.]+px, (-?[\d.]+)px\)/.exec(round?.style.transform ?? '')?.[1] ?? '0');

    expect(headerTop).toBe(thirdPlace.y - 20 - 50);
  });

  it('narrows the grid by the column the fold saves', () => {
    const separate = bracketTestDriver({ source: source(), layouts: testBracketLayouts });
    const folded = bracketTestDriver({ source: source(), layouts: testBracketLayouts, thirdPlaceTopOffset: 240 });
    const widthOf = (driver: ReturnType<typeof bracketTestDriver>) =>
      Number.parseFloat(driver.element().querySelector<HTMLElement>('.et-bracket')?.style.width ?? '0');

    expect(widthOf(folded)).toBe(widthOf(separate) - 250 - 60);
  });
});

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
