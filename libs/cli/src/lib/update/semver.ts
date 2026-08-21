const NUMERIC = /^\d+$/;

type ParsedVersion = {
  numbers: number[];
  prerelease: string[];
};

const parseVersion = (version: string): ParsedVersion => {
  const [core = '', ...prereleaseParts] = version.split('-');
  const prerelease = prereleaseParts.join('-');

  return {
    numbers: core.split('.').map((part) => Number.parseInt(part, 10) || 0),
    prerelease: prerelease === '' ? [] : prerelease.split('.'),
  };
};

const comparePrerelease = (left: string[], right: string[]) => {
  // Semver: a version without a prerelease outranks the same version with one.
  if (left.length === 0 && right.length === 0) return 0;
  if (left.length === 0) return 1;
  if (right.length === 0) return -1;

  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const leftPart = left[index];
    const rightPart = right[index];

    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;

    if (NUMERIC.test(leftPart) && NUMERIC.test(rightPart)) {
      const leftNumber = Number.parseInt(leftPart, 10);
      const rightNumber = Number.parseInt(rightPart, 10);

      if (leftNumber !== rightNumber) return leftNumber < rightNumber ? -1 : 1;
      continue;
    }

    if (leftPart !== rightPart) return leftPart < rightPart ? -1 : 1;
  }

  return 0;
};

/** `-1`, `0` or `1`, prerelease-aware for the `x.y.z-next.N` versions this repo publishes. */
export const compareVersions = (left: string, right: string) => {
  const parsedLeft = parseVersion(left);
  const parsedRight = parseVersion(right);

  for (let index = 0; index < Math.max(parsedLeft.numbers.length, parsedRight.numbers.length); index += 1) {
    const leftNumber = parsedLeft.numbers[index] ?? 0;
    const rightNumber = parsedRight.numbers[index] ?? 0;

    if (leftNumber !== rightNumber) return leftNumber < rightNumber ? -1 : 1;
  }

  return comparePrerelease(parsedLeft.prerelease, parsedRight.prerelease);
};

export const isNewer = (candidate: string, than: string) => compareVersions(candidate, than) > 0;

/** True when `version` sits inside `(after, upTo]`, the range a pending migration is selected by. */
export const isInUpdateRange = (options: { version: string; after: string; upTo: string }) =>
  compareVersions(options.version, options.after) > 0 && compareVersions(options.version, options.upTo) <= 0;

export const isValidVersion = (version: string) => /^\d+\.\d+\.\d+(?:[-+].*)?$/.test(version);

/**
 * The dist tag a prerelease belongs to, for example `next` for `5.0.0-next.46`. A stable version has
 * none, and neither has a prerelease that only numbers its identifiers.
 */
export const prereleaseTag = (version: string) => parseVersion(version).prerelease.find((part) => !NUMERIC.test(part));

/** The `^` or `~` a range keeps, or `''` for an exact one. `undefined` for a range with no single version. */
export const rangePrefix = (range: string) => {
  const match = /^([\^~]?)(\d+\.\d+\.\d+(?:[-+][\w.-]+)?)$/.exec(range.trim());

  return match ? (match[1] as string) : undefined;
};

/** The version a range points at, for example `5.0.0-next.46` for `^5.0.0-next.46`. */
export const versionOfRange = (range: string) => {
  const match = /^[\^~]?(\d+\.\d+\.\d+(?:[-+][\w.-]+)?)$/.exec(range.trim());

  return match?.[1];
};
