import { BracketMatch } from '../../types';

export type ConnectedMatches = {
  previousMatches: (BracketMatch | null)[] | null;
  nextMatch: BracketMatch | null;
};
