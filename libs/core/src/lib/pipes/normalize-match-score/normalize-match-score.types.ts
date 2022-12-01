export interface NormalizedMatchScore {
  home: {
    score: string | number | null;
    isWinner: boolean;
  };
  away: {
    score: string | number | null;
    isWinner: boolean;
  };
  subLine: string | null;
  isNumeric: boolean;
}
