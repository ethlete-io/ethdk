import {
  BRACKET_DATA_LAYOUT,
  BracketDataLayout,
  BracketDataSource,
  BracketRoundRelation,
  createBracket,
} from '@ethlete/bracket';
import { generateDoubleEliminationBracket, generateSingleEliminationBracket } from './stories/generate-bracket';

/** `id → type · neighbours`, which is the whole relation graph in one readable line per round. */
const describeRelation = (relation: BracketRoundRelation<null, null>) => {
  const parts: string[] = [relation.type];

  if ('previousRound' in relation) parts.push(`prev=${relation.previousRound.id}`);
  if ('previousUpperRound' in relation) parts.push(`prevUpper=${relation.previousUpperRound.id}`);
  if ('previousLowerRound' in relation) parts.push(`prevLower=${relation.previousLowerRound.id}`);
  if ('nextRound' in relation) parts.push(`next=${relation.nextRound.id}`);

  return parts.join(' ');
};

const relations = (source: BracketDataSource<null, null>, layout: BracketDataLayout) => {
  const bracket = createBracket(source, { layout });
  const result: Record<string, string> = {};

  for (const round of bracket.rounds.values()) {
    result[round.id] = describeRelation(round.relation);
  }

  return result;
};

describe('generateRoundRelations', () => {
  it('wires a mirrored single elimination out along one side and back along the other', () => {
    expect(relations(generateSingleEliminationBracket(8), BRACKET_DATA_LAYOUT.MIRRORED)).toEqual({
      'se-r0--half-1': 'nothing-to-one next=se-r1--half-1',
      'se-r1--half-1': 'one-to-one prev=se-r0--half-1 next=se-r2',
      // The middle of the fold takes one side as its previous; the other reaches it from its own side.
      'se-r2': 'one-to-nothing prev=se-r1--half-1',
      'se-r1--half-2': 'one-to-one prev=se-r0--half-2 next=se-r2',
      'se-r0--half-2': 'nothing-to-one next=se-r1--half-2',
    });
  });

  it('wires a mirrored double elimination without letting the finals stand in for a fold neighbour', () => {
    // The trap: in the round map a right half sits next to the grand final, so array-order navigation
    // would have `ub-r1--half-2` feed the bracket reset instead of the winners round it actually feeds.
    expect(
      relations(
        generateDoubleEliminationBracket({ participantCount: 8, includeFinal: true }),
        BRACKET_DATA_LAYOUT.MIRRORED,
      ),
    ).toEqual({
      'ub-r0--half-1': 'nothing-to-one next=ub-r1--half-1',
      'ub-r1--half-1': 'one-to-one prev=ub-r0--half-1 next=ub-r2',
      'ub-r2': 'one-to-one prev=ub-r1--half-1 next=final',
      'ub-r1--half-2': 'one-to-one prev=ub-r0--half-2 next=ub-r2',
      'ub-r0--half-2': 'nothing-to-one next=ub-r1--half-2',
      'lb-r0--half-1': 'nothing-to-one next=lb-r1--half-1',
      'lb-r1--half-1': 'one-to-one prev=lb-r0--half-1 next=lb-r2',
      'lb-r2': 'one-to-one prev=lb-r1--half-1 next=lb-r3',
      // The deepest lower round feeds the grand final, not whichever half closed the map.
      'lb-r3': 'one-to-one prev=lb-r2 next=final',
      'lb-r1--half-2': 'one-to-one prev=lb-r0--half-2 next=lb-r2',
      'lb-r0--half-2': 'nothing-to-one next=lb-r1--half-2',
      final: 'two-to-one prevUpper=ub-r2 prevLower=lb-r3 next=reverse-final',
      'reverse-final': 'one-to-nothing prev=final',
    });
  });

  it('leaves an unmirrored double elimination exactly as it was', () => {
    expect(
      relations(
        generateDoubleEliminationBracket({ participantCount: 8, includeFinal: true }),
        BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT,
      ),
    ).toEqual({
      'ub-r0': 'nothing-to-one next=ub-r1',
      'ub-r1': 'one-to-one prev=ub-r0 next=ub-r2',
      'ub-r2': 'one-to-one prev=ub-r1 next=final',
      'lb-r0': 'nothing-to-one next=lb-r1',
      'lb-r1': 'one-to-one prev=lb-r0 next=lb-r2',
      'lb-r2': 'one-to-one prev=lb-r1 next=lb-r3',
      'lb-r3': 'one-to-one prev=lb-r2 next=final',
      final: 'two-to-one prevUpper=ub-r2 prevLower=lb-r3 next=reverse-final',
      'reverse-final': 'one-to-nothing prev=final',
    });
  });
});
