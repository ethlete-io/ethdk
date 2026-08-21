import { describe, expect, it } from 'vitest';
import {
  compareVersions,
  isInUpdateRange,
  isNewer,
  isValidVersion,
  prereleaseTag,
  rangePrefix,
  versionOfRange,
} from './semver';

describe('compareVersions', () => {
  it('orders release numbers', () => {
    expect(compareVersions('1.2.3', '1.2.4')).toBe(-1);
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
    expect(compareVersions('2.0.0', '2.0.0')).toBe(0);
  });

  it('ranks a release above its own prerelease', () => {
    expect(compareVersions('5.0.0', '5.0.0-next.1')).toBe(1);
    expect(compareVersions('5.0.0-next.1', '5.0.0')).toBe(-1);
  });

  it('orders prerelease counters numerically', () => {
    expect(compareVersions('5.0.0-next.9', '5.0.0-next.10')).toBe(-1);
  });

  it('orders prerelease identifiers alphabetically', () => {
    expect(compareVersions('5.0.0-beta.1', '5.0.0-next.1')).toBe(-1);
  });
});

describe('isNewer', () => {
  it('is false for the same version', () => {
    expect(isNewer('1.0.0', '1.0.0')).toBe(false);
  });

  it('is true for a newer prerelease', () => {
    expect(isNewer('1.0.0-next.2', '1.0.0-next.1')).toBe(true);
  });
});

describe('isInUpdateRange', () => {
  it('excludes the version already installed', () => {
    expect(isInUpdateRange({ version: '5.0.0', after: '5.0.0', upTo: '6.0.0' })).toBe(false);
  });

  it('includes the target itself', () => {
    expect(isInUpdateRange({ version: '6.0.0', after: '5.0.0', upTo: '6.0.0' })).toBe(true);
  });

  it('excludes a version beyond the target', () => {
    expect(isInUpdateRange({ version: '6.0.1', after: '5.0.0', upTo: '6.0.0' })).toBe(false);
  });
});

describe('isValidVersion', () => {
  it('accepts a release and a prerelease', () => {
    expect(isValidVersion('1.2.3')).toBe(true);
    expect(isValidVersion('1.2.3-next.4')).toBe(true);
  });

  it('rejects a range and a partial version', () => {
    expect(isValidVersion('^1.2.3')).toBe(false);
    expect(isValidVersion('1.2')).toBe(false);
  });
});

describe('prereleaseTag', () => {
  it('reads the identifier a prerelease belongs to', () => {
    expect(prereleaseTag('5.0.0-next.46')).toBe('next');
    expect(prereleaseTag('5.0.0-beta.1')).toBe('beta');
  });

  it('has none for a release', () => {
    expect(prereleaseTag('5.0.0')).toBeUndefined();
  });

  it('has none for a prerelease that only numbers itself', () => {
    expect(prereleaseTag('5.0.0-1')).toBeUndefined();
  });
});

describe('rangePrefix', () => {
  it('reads the prefix of a single-version range', () => {
    expect(rangePrefix('^5.0.0')).toBe('^');
    expect(rangePrefix('~5.0.0-next.1')).toBe('~');
    expect(rangePrefix('5.0.0')).toBe('');
  });

  it('has none for a range no single version can be written into', () => {
    expect(rangePrefix('>=5 <6')).toBeUndefined();
    expect(rangePrefix('workspace:*')).toBeUndefined();
  });
});

describe('versionOfRange', () => {
  it('reads the version behind a range', () => {
    expect(versionOfRange('^5.0.0-next.46')).toBe('5.0.0-next.46');
    expect(versionOfRange('5.0.0')).toBe('5.0.0');
  });

  it('reads nothing from a range with no single version', () => {
    expect(versionOfRange('*')).toBeUndefined();
  });
});
