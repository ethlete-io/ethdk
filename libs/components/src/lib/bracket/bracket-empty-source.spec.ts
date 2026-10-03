import '../../test-helpers';
import { generateSingleEliminationBracket } from './stories/generate-bracket';
import { bracketTestDriver, testBracketLayouts } from './testing/bracket-driver';

describe('BracketComponent with an empty source', () => {
  it.each(['bracket', 'rounds-list'] as const)('fails the %s with ET3401, the documented error', (component) => {
    const mount = () =>
      bracketTestDriver({
        component,
        source: { rounds: [], matches: [], mode: generateSingleEliminationBracket(4).mode },
        layouts: testBracketLayouts,
      }).detectChanges();

    expect(mount).toThrow(/ET3401/);
  });
});
