import { Tree } from '@nx/devkit';

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies'] as const;

type PackageJson = Partial<Record<(typeof DEPENDENCY_FIELDS)[number], Record<string, string>>>;

/** `^1.0.0-next.34` / `>=1.2.3 <2` / `~1.2.3` → the version the comparison runs against, or `null`. */
const versionFromRange = (range: string) => {
  const first = range.split('||')[0]?.trim() ?? '';
  const cleaned = first.split(/\s+/)[0]?.replace(/^[\^~=v]+|^>=?|^<=?/, '') ?? '';

  return /^\d+\.\d+/.test(cleaned) ? cleaned : null;
};

/**
 * The version of `packageName` the workspace declares, or `null` when it declares none (or a range no
 * comparison can be made against, like `workspace:*`).
 */
export const readInstalledVersion = (tree: Tree, packageName: string): string | null => {
  const raw = tree.read('package.json', 'utf-8');

  if (!raw) {
    return null;
  }

  let parsed: PackageJson;

  try {
    parsed = JSON.parse(raw) as PackageJson;
  } catch {
    return null;
  }

  for (const field of DEPENDENCY_FIELDS) {
    const range = parsed[field]?.[packageName];

    if (range) {
      const version = versionFromRange(range);

      if (version) {
        return version;
      }
    }
  }

  return null;
};

const parseVersion = (version: string) => {
  const [core = '', ...prereleaseParts] = version.split('-');

  return {
    numbers: core.split('.').map((part) => Number.parseInt(part, 10) || 0),
    prerelease: prereleaseParts.join('-'),
  };
};

const comparePrerelease = (left: string, right: string) => {
  // Semver: a version without a prerelease outranks the same version with one.
  if (left === right) return 0;
  if (left === '') return 1;
  if (right === '') return -1;

  const leftParts = left.split('.');
  const rightParts = right.split('.');

  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const leftPart = leftParts[index];
    const rightPart = rightParts[index];

    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;

    const leftNumber = Number.parseInt(leftPart, 10);
    const rightNumber = Number.parseInt(rightPart, 10);
    const bothNumeric = /^\d+$/.test(leftPart) && /^\d+$/.test(rightPart);

    if (bothNumeric) {
      if (leftNumber !== rightNumber) return leftNumber < rightNumber ? -1 : 1;
      continue;
    }

    if (leftPart !== rightPart) return leftPart < rightPart ? -1 : 1;
  }

  return 0;
};

/** `-1` / `0` / `1`, prerelease-aware enough for the `x.y.z-next.N` versions this repo publishes. */
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

/** An unknown installed version counts as satisfied - the caller reports the assumption instead. */
export const isSinceSatisfied = (installed: string | null, since: string) =>
  installed === null || compareVersions(installed, since) >= 0;
