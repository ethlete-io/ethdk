import { describe, expect, it } from 'vitest';
import { BRACKET_DATA_LAYOUT } from './core';
import { createBracket } from './linked';
import { createPlaceholderBracketSource, PlaceholderBracketShape } from './placeholder-source';

const matchCountsByRound = (shape: PlaceholderBracketShape) => {
  const source = createPlaceholderBracketSource(shape);

  return source.rounds.map((round) => ({
    type: round.type,
    matches: source.matches.filter((match) => match.roundId === round.id).length,
  }));
};

describe('createPlaceholderBracketSource', () => {
  it('halves a single elimination down to the final', () => {
    expect(matchCountsByRound({ mode: 'single-elimination', participantCount: 8 })).toEqual([
      { type: 'single-elimination-bracket', matches: 4 },
      { type: 'single-elimination-bracket', matches: 2 },
      { type: 'final', matches: 1 },
    ]);
  });

  it('appends a third place to a single elimination', () => {
    expect(matchCountsByRound({ mode: 'single-elimination', participantCount: 4, includeThirdPlace: true })).toEqual([
      { type: 'single-elimination-bracket', matches: 2 },
      { type: 'final', matches: 1 },
      { type: 'third-place', matches: 1 },
    ]);
  });

  it('builds both halves and the finals of a double elimination', () => {
    expect(matchCountsByRound({ mode: 'double-elimination', participantCount: 8 })).toEqual([
      { type: 'upper-bracket', matches: 4 },
      { type: 'upper-bracket', matches: 2 },
      { type: 'upper-bracket', matches: 1 },
      { type: 'lower-bracket', matches: 2 },
      { type: 'lower-bracket', matches: 2 },
      { type: 'lower-bracket', matches: 1 },
      { type: 'lower-bracket', matches: 1 },
      { type: 'final', matches: 1 },
      { type: 'reverse-final', matches: 1 },
    ]);
  });

  it('drops the reverse final with the final, and adds a third place on request', () => {
    const types = (shape: PlaceholderBracketShape) => matchCountsByRound(shape).map((round) => round.type);

    expect(types({ mode: 'double-elimination', participantCount: 4, includeReverseFinal: false })).not.toContain(
      'reverse-final',
    );
    expect(
      types({ mode: 'double-elimination', participantCount: 4, includeFinal: false, includeThirdPlace: true }),
    ).toEqual(['upper-bracket', 'upper-bracket', 'lower-bracket', 'lower-bracket', 'third-place']);
  });

  it('leaves every match empty and pending', () => {
    const { matches } = createPlaceholderBracketSource({ mode: 'double-elimination', participantCount: 16 });

    for (const match of matches) {
      expect(match).toMatchObject({ home: null, away: null, winner: null, status: 'pending', data: null });
    }
    expect(new Set(matches.map((match) => match.id)).size).toBe(matches.length);
  });

  it.each([
    { mode: 'single-elimination', participantCount: 32 },
    { mode: 'double-elimination', participantCount: 32 },
  ] as const)('links into a bracket in both data layouts ($mode)', (shape) => {
    const source = createPlaceholderBracketSource(shape);

    for (const layout of [BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT, BRACKET_DATA_LAYOUT.MIRRORED]) {
      expect(createBracket(source, { layout }).matches.size).toBe(source.matches.length);
    }
  });

  it.each([
    { mode: 'single-elimination', participantCount: 6 },
    { mode: 'single-elimination', participantCount: 1 },
    { mode: 'double-elimination', participantCount: 2 },
    { mode: 'double-elimination', participantCount: 12.5 },
  ] as const)('throws ET3415 for $participantCount participants in $mode', (shape) => {
    expect(() => createPlaceholderBracketSource(shape)).toThrow('ET3415');
  });
});
