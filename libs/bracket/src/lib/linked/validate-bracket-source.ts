import { CreateBracketOptions } from '../core';
import { BracketRuntimeError } from '../bracket-runtime-error';
import { BracketDataSource } from '../integrations';
import { createBracket } from './bracket';

/**
 * Runs {@link createBracket} on `source` and returns the `BracketRuntimeError` it would throw, or `null` for a
 * usable source. Any other error is rethrown.
 */
export const validateBracketSource = <TRoundData, TMatchData>(
  source: BracketDataSource<TRoundData, TMatchData>,
  options: CreateBracketOptions<TMatchData>,
): BracketRuntimeError | null => {
  try {
    createBracket(source, options);

    return null;
  } catch (error) {
    if (error instanceof BracketRuntimeError) return error;

    throw error;
  }
};
