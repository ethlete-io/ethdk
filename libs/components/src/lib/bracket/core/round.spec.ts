import { generateDoubleEliminationBracket, generateSingleEliminationBracket } from '../stories/generate-bracket';
import { BracketDataSource } from '../integrations';
import { BRACKET_DATA_LAYOUT, BracketDataLayout } from './layout';
import { createRoundsMapBase } from './round';

/** `id · depth · side`, which is everything the fold needs from a round. */
const foldShape = (source: BracketDataSource<null, null>, layout: BracketDataLayout) =>
  Array.from(createRoundsMapBase(source, { layout }).values()).map(
    (round) => `${round.id} ${round.logicalIndex} ${round.mirrorRoundType ?? '-'}`,
  );

describe('createRoundsMapBase', () => {
  describe('left to right', () => {
    it('leaves every round whole, at its depth in its own bracket', () => {
      expect(foldShape(generateSingleEliminationBracket(8), BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT)).toEqual([
        'se-r0 0 -',
        'se-r1 1 -',
        'se-r2 2 -',
      ]);
    });

    it('counts the upper and lower brackets separately, with the finals continuing the lower count', () => {
      expect(
        foldShape(
          generateDoubleEliminationBracket({ participantCount: 8, includeFinal: true }),
          BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT,
        ),
      ).toEqual([
        'ub-r0 0 -',
        'ub-r1 1 -',
        'ub-r2 2 -',
        'lb-r0 0 -',
        'lb-r1 1 -',
        'lb-r2 2 -',
        'lb-r3 3 -',
        'final 4 -',
        'reverse-final 5 -',
      ]);
    });
  });

  describe('mirrored', () => {
    it('folds a single-elimination bracket around the rounds it cannot halve', () => {
      // Out along the left, through the one-match final, back along the right — and the two halves of a
      // round share its depth.
      expect(foldShape(generateSingleEliminationBracket(8), BRACKET_DATA_LAYOUT.MIRRORED)).toEqual([
        'se-r0--half-1 0 left',
        'se-r1--half-1 1 left',
        'se-r2 2 -',
        'se-r1--half-2 1 right',
        'se-r0--half-2 0 right',
      ]);
    });

    it('folds both brackets of a double elimination, deepest right half last', () => {
      expect(
        foldShape(
          generateDoubleEliminationBracket({ participantCount: 8, includeFinal: true }),
          BRACKET_DATA_LAYOUT.MIRRORED,
        ),
      ).toEqual([
        'ub-r0--half-1 0 left',
        'ub-r1--half-1 1 left',
        'ub-r2 2 -',
        'lb-r0--half-1 0 left',
        'lb-r1--half-1 1 left',
        'lb-r2 2 -',
        'lb-r3 3 -',
        'final 4 -',
        'reverse-final 5 -',
        'lb-r1--half-2 1 right',
        'lb-r0--half-2 0 right',
        'ub-r1--half-2 1 right',
        'ub-r0--half-2 0 right',
      ]);
    });

    it('halves the match count of a split round and keeps every match', () => {
      const rounds = createRoundsMapBase(generateSingleEliminationBracket(8), {
        layout: BRACKET_DATA_LAYOUT.MIRRORED,
      });

      const left = rounds.getOrThrow('se-r0--half-1' as never);
      const right = rounds.getOrThrow('se-r0--half-2' as never);

      expect([left.matchCount, right.matchCount]).toEqual([2, 2]);
      expect([...left.matchIds, ...right.matchIds]).toEqual(['se-r0-m0', 'se-r0-m1', 'se-r0-m2', 'se-r0-m3']);
    });
  });
});
