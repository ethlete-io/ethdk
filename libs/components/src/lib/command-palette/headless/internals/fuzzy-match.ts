/** A `[start, end)` slice of the haystack that query characters matched. */
export type FuzzyMatchRange = [start: number, end: number];

export type FuzzyMatch = {
  score: number;
  /** Merged, ascending, non-overlapping. Empty when the query was empty. */
  ranges: FuzzyMatchRange[];
};

const MATCH = 16;
const BOUNDARY_BONUS = 24;
const CAMEL_BONUS = 20;
const FIRST_CHAR_BONUS = 8;
const CASE_BONUS = 2;
const GAP_START_PENALTY = 3;
const GAP_EXTEND_PENALTY = 1;
const MAX_LEADING_PENALTY = 6;

/**
 * Paid per character of an unbroken run, times how long the run already is. Growing with the run is
 * what makes an exact substring beat a scattered subsequence: on the query `user`, a flat bonus ranks
 * `Unset serial` (a strong `u` plus `ser`) above `Add user`, which is not what anyone typing means.
 */
const CONSECUTIVE_BONUS = 12;

const UNREACHABLE = -1_000_000;

const isLower = (char: string) => char >= 'a' && char <= 'z';
const isUpper = (char: string) => char >= 'A' && char <= 'Z';
const isDigit = (char: string) => char >= '0' && char <= '9';
const isAlphanumeric = (char: string) => isLower(char) || isUpper(char) || isDigit(char);

/**
 * What a match at this position is worth beyond the base score. The start of the haystack and the start
 * of a word are what a reader scans for, so a hit there ranks above one buried mid-word.
 */
const positionBonus = (haystack: string, index: number) => {
  if (index === 0) {
    return BOUNDARY_BONUS + FIRST_CHAR_BONUS;
  }

  const current = haystack[index] ?? '';
  const before = haystack[index - 1] ?? '';

  if (!isAlphanumeric(before)) {
    return BOUNDARY_BONUS;
  }

  if (isLower(before) && isUpper(current)) {
    return CAMEL_BONUS;
  }

  if (!isDigit(before) && isDigit(current)) {
    return CAMEL_BONUS;
  }

  return 0;
};

/**
 * Scores `query` against `haystack` as a subsequence, and reports which characters matched.
 *
 * Returns `null` when a query character is missing, so a caller can filter and rank in one pass. An
 * empty query matches with score `0` and no ranges. Matching is case-insensitive, but a match that
 * agrees in case scores slightly higher.
 *
 * A score is only meaningful against other scores for the same query. Do not persist it or compare it
 * across queries.
 */
export const fuzzyMatch = (query: string, haystack: string): FuzzyMatch | null => {
  if (!query) {
    return { score: 0, ranges: [] };
  }

  if (!haystack || query.length > haystack.length) {
    return null;
  }

  const lowerQuery = query.toLowerCase();
  const lowerHaystack = haystack.toLowerCase();
  const queryLength = lowerQuery.length;
  const haystackLength = lowerHaystack.length;

  // `scores[i][j]` is the best alignment of query[0..i] whose last character sits at haystack[j], and
  // `parents[i][j]` the haystack index query[i - 1] used in it, so the matched ranges can be traced
  // back. A full table is needed because greedy first-fit picks the wrong characters: on the query
  // "ct", "Create table" would match the "t" inside "Create" rather than the one starting "table".
  //
  // `runs[i][j]` is how long the unbroken run ending at that cell is, which the consecutive bonus is
  // scaled by. It describes the best-scoring path into the cell only, so a lower-scoring path that
  // could have extended a longer run is not considered - the ranking that costs is not worth a third
  // dimension of state.
  const scores = new Int32Array(queryLength * haystackLength).fill(UNREACHABLE);
  const parents = new Int32Array(queryLength * haystackLength).fill(-1);
  const runs = new Int32Array(queryLength * haystackLength);

  for (let i = 0; i < queryLength; i++) {
    const queryChar = lowerQuery[i];
    const row = i * haystackLength;
    const previousRow = row - haystackLength;

    // Running best over the previous row, held in the form that makes a gap-penalised lookup O(1):
    // the penalty for jumping from j' to j is GAP_START + GAP_EXTEND * (j - j' - 2), so adding
    // GAP_EXTEND * j' to each candidate turns "best after penalty" into a plain maximum.
    let bestAdjusted = UNREACHABLE;
    let bestAdjustedIndex = -1;

    for (let j = i; j < haystackLength; j++) {
      if (i > 0 && j >= 2) {
        const candidate = scores[previousRow + j - 2] ?? UNREACHABLE;

        if (candidate > UNREACHABLE) {
          const adjusted = candidate + GAP_EXTEND_PENALTY * (j - 2);

          if (adjusted > bestAdjusted) {
            bestAdjusted = adjusted;
            bestAdjustedIndex = j - 2;
          }
        }
      }

      if (lowerHaystack[j] !== queryChar) {
        continue;
      }

      const caseBonus = haystack[j] === query[i] ? CASE_BONUS : 0;
      const base = MATCH + positionBonus(haystack, j) + caseBonus;

      if (i === 0) {
        scores[row + j] = base - Math.min(j, MAX_LEADING_PENALTY);
        runs[row + j] = 1;
        continue;
      }

      const consecutive = scores[previousRow + j - 1] ?? UNREACHABLE;
      const consecutiveRun = runs[previousRow + j - 1] ?? 0;
      const consecutiveScore =
        consecutive > UNREACHABLE ? consecutive + base + CONSECUTIVE_BONUS * consecutiveRun : UNREACHABLE;

      const gapScore =
        bestAdjustedIndex >= 0 ? bestAdjusted - GAP_EXTEND_PENALTY * (j - 2) - GAP_START_PENALTY + base : UNREACHABLE;

      if (consecutiveScore === UNREACHABLE && gapScore === UNREACHABLE) {
        continue;
      }

      if (consecutiveScore >= gapScore) {
        scores[row + j] = consecutiveScore;
        parents[row + j] = j - 1;
        runs[row + j] = consecutiveRun + 1;
      } else {
        scores[row + j] = gapScore;
        parents[row + j] = bestAdjustedIndex;
        runs[row + j] = 1;
      }
    }
  }

  const lastRow = (queryLength - 1) * haystackLength;
  let endIndex = -1;
  let score = UNREACHABLE;

  for (let j = queryLength - 1; j < haystackLength; j++) {
    const candidate = scores[lastRow + j] ?? UNREACHABLE;

    if (candidate > score) {
      score = candidate;
      endIndex = j;
    }
  }

  if (endIndex < 0 || score === UNREACHABLE) {
    return null;
  }

  const indices: number[] = [];

  for (let i = queryLength - 1, j = endIndex; i >= 0 && j >= 0; i--) {
    indices.push(j);
    j = parents[i * haystackLength + j] ?? -1;
  }

  indices.reverse();

  const ranges: FuzzyMatchRange[] = [];

  for (const index of indices) {
    const last = ranges[ranges.length - 1];

    if (last && last[1] === index) {
      last[1] = index + 1;
    } else {
      ranges.push([index, index + 1]);
    }
  }

  return { score, ranges };
};
