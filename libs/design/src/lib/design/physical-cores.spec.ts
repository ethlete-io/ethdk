import { availableParallelism } from 'os';
import { describe, expect, it } from 'vitest';
import { CoreProbe, physicalCoresOf } from './physical-cores';

const probe = (overrides: Partial<CoreProbe>): CoreProbe => ({
  platform: 'darwin',
  sysctl: () => Number.NaN,
  lscpu: () => Number.NaN,
  logical: () => 12,
  ...overrides,
});

describe('physicalCoresOf', () => {
  it('counts the physical cores of a Mac, not its logical CPUs', () => {
    expect(physicalCoresOf(probe({ sysctl: () => 6 }))).toBe(6);
  });

  it('counts the cores lscpu lists on Linux', () => {
    expect(physicalCoresOf(probe({ platform: 'linux', sysctl: () => 99, lscpu: () => 8 }))).toBe(8);
  });

  it('takes half the logical CPUs when the machine cannot be asked', () => {
    expect(physicalCoresOf(probe({}))).toBe(6);
    expect(physicalCoresOf(probe({ platform: 'linux', logical: () => 1 }))).toBe(1);
  });

  it('reads this machine as at least one core and at most its logical CPUs', () => {
    const cores = physicalCoresOf();

    expect(cores).toBeGreaterThanOrEqual(1);
    expect(cores).toBeLessThanOrEqual(availableParallelism());
  });
});
