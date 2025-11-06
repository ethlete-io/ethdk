import { BracketMatch } from '../../types';

export interface ConnectedMatches {
  previousMatches: (BracketMatch | null)[] | null;
  nextMatch: BracketMatch | null;
}
