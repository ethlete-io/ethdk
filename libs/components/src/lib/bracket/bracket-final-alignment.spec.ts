import '../../test-helpers';
import { BRACKET_DEFAULT_CARDS } from './bracket-default-cards';
import { BracketConfig, provideBracketConfig } from './bracket.config';
import { bracketTestDriver, testBracketLayouts } from './testing/bracket-driver';
import { generateDoubleEliminationBracket } from './stories/generate-bracket';

const mount = (config: BracketConfig) =>
  bracketTestDriver({
    source: generateDoubleEliminationBracket({ participantCount: 8, includeFinal: true }),
    layouts: testBracketLayouts,
    providers: [provideBracketConfig({ ...BRACKET_DEFAULT_CARDS, ...config })],
  });

const centerOf = (driver: ReturnType<typeof mount>, matchId: string) =>
  driver.positionOf(matchId).y + parseFloat(driver.cellFor(matchId)?.style.height ?? '0') / 2;

describe('BracketComponent final alignment', () => {
  it('draws the final and the bracket reset level with the upper bracket final by default', () => {
    const driver = mount({});

    for (const id of ['final-m0', 'reverse-final-m0']) {
      expect(centerOf(driver, id)).toBe(centerOf(driver, 'ub-r2-m0'));
    }
  });

  it('centres the final and the bracket reset between the upper and the lower bracket final', () => {
    const driver = mount({ finalAlignment: 'center' });
    const midpoint = (centerOf(driver, 'ub-r2-m0') + centerOf(driver, 'lb-r3-m0')) / 2;

    expect(midpoint).toBeGreaterThan(centerOf(driver, 'ub-r2-m0'));

    for (const id of ['final-m0', 'reverse-final-m0']) {
      expect(centerOf(driver, id)).toBe(midpoint);
    }
  });
});
