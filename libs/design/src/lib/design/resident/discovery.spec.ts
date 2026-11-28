import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { liveDiscoveryOf, readDiscovery, removeDiscovery, writeDiscovery } from './discovery';

const discoveryOf = (target: string, pid: number) => ({
  pid,
  port: 4000,
  checkout: target,
  build: 'b1',
  token: 't',
  startedAt: '',
});

describe('discovery', () => {
  it('drops the file of a dead process and keeps the one of a live process', () => {
    const target = mkdtempSync(join(tmpdir(), 'cli-resident-discovery-'));

    writeDiscovery(target, discoveryOf(target, 11));

    expect(liveDiscoveryOf({ target, alive: (pid) => pid === 11 })?.pid).toBe(11);
    expect(liveDiscoveryOf({ target, alive: () => false })).toBe(null);
    expect(readDiscovery(target)).toBe(null);
  });

  it('removes with a pid only the file that process wrote', () => {
    const target = mkdtempSync(join(tmpdir(), 'cli-resident-discovery-'));

    writeDiscovery(target, discoveryOf(target, 12));
    removeDiscovery(target, 13);

    expect(readDiscovery(target)?.pid).toBe(12);

    removeDiscovery(target, 12);

    expect(readDiscovery(target)).toBe(null);
  });
});
