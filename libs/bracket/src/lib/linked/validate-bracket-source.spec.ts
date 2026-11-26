import { BRACKET_ERROR_CODES } from '../bracket-errors';
import { BracketRuntimeError } from '../bracket-runtime-error';
import { BRACKET_DATA_LAYOUT } from '../core';
import { BracketDataSource } from '../integrations';
import { validateBracketSource } from './validate-bracket-source';

const options = { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT };

describe('validateBracketSource', () => {
  it('returns null for a usable source', () => {
    const source: BracketDataSource<null, null> = {
      mode: 'single-elimination',
      rounds: [{ id: 'r1', name: 'Final', type: 'final', data: null }],
      matches: [{ id: 'm1', roundId: 'r1', home: 'a', away: 'b', winner: null, status: 'pending', data: null }],
    };

    expect(validateBracketSource(source, options)).toBeNull();
  });

  it('returns the error createBracket would throw instead of throwing it', () => {
    const error = validateBracketSource({ mode: 'single-elimination', rounds: [], matches: [] }, options);

    expect(error).toBeInstanceOf(BracketRuntimeError);
    expect(error?.code).toBe(BRACKET_ERROR_CODES.SOURCE_EMPTY);
  });
});
