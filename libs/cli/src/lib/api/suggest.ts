const cell = (row: number[], index: number) => row[index] ?? 0;

const distance = (one: string, two: string) => {
  let previous = Array.from({ length: two.length + 1 }, (_, index) => index);

  for (let row = 1; row <= one.length; row++) {
    const current = [row];

    for (let column = 1; column <= two.length; column++) {
      const substitution = cell(previous, column - 1) + (one[row - 1] === two[column - 1] ? 0 : 1);

      current.push(Math.min(cell(current, column - 1) + 1, cell(previous, column) + 1, substitution));
    }

    previous = current;
  }

  return cell(previous, two.length);
};

/**
 * The candidate closest to `input`, or undefined when none is close enough to suggest. A short input
 * accepts one edit and a longer one two, so a typo is caught without guessing at a different word.
 */
export const closestMatch = (input: string, candidates: string[]) => {
  const limit = input.length <= 4 ? 1 : 2;

  const [best] = candidates
    .map((candidate) => ({ candidate, gap: distance(input.toLowerCase(), candidate.toLowerCase()) }))
    .sort((one, two) => one.gap - two.gap);

  return best && best.gap <= limit ? best.candidate : undefined;
};

/** The " Did you mean …?" tail of an error, empty when nothing is close enough. */
export const didYouMean = (input: string, candidates: string[]) => {
  const suggestion = closestMatch(input, candidates);

  return suggestion ? ` Did you mean "${suggestion}"?` : '';
};
