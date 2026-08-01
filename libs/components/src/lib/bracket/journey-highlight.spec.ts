import { BRACKET_DATA_LAYOUT } from './core';
import { createBracketJourneyParticipants } from './journey-highlight';
import { createBracket } from './linked';
import { BracketDataSource } from './integrations';
import { generateDoubleEliminationBracket, generateSingleEliminationBracket } from './stories/generate-bracket';

const journeys = (source: BracketDataSource<null, null>) => {
  const bracket = createBracket(source, { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });
  const participants = createBracketJourneyParticipants(bracket);

  return new Map(participants.map((participant) => [participant.id, participant.eliminatedAtMatchId]));
};

describe('createBracketJourneyParticipants', () => {
  it('ends a single-elimination run at the match that was lost', () => {
    // The generator advances `home` everywhere, so the away side of the opening match goes out there.
    expect(journeys(generateSingleEliminationBracket(8)).get('p2')).toBe('se-r0-m0');
  });

  it('leaves the winner of everything in the tournament', () => {
    expect(journeys(generateSingleEliminationBracket(8)).get('p1')).toBeNull();
  });

  it('keeps a participant in while a match of theirs is undecided', () => {
    // Both finalists reach an unplayed grand final - neither is out, however many matches they lost.
    const source = generateDoubleEliminationBracket({ participantCount: 8, includeFinal: true });

    expect(journeys(source).get('u1')).toBeNull();
    expect(journeys(source).get('l3-0h')).toBeNull();
  });

  it('ends a double-elimination run at the last match, not the first loss', () => {
    const source = generateDoubleEliminationBracket({ participantCount: 8, includeFinal: false });
    const eliminated = journeys(source);

    // `l0-0a` loses their only match; `l0-0h` wins it and goes out in the next lower round.
    expect(eliminated.get('l0-0a')).toBe('lb-r0-m0');
    expect(eliminated.get('u2')).toBe('ub-r0-m0');
  });
});
