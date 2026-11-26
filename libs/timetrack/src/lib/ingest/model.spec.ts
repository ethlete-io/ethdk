import { describe, expect, it } from 'vitest';
import { INGEST_PROTOCOL_VERSION, ingestEndpoint, isUsableDiscovery } from './model';

const discovery = (overrides: Record<string, unknown> = {}) => ({
  version: INGEST_PROTOCOL_VERSION,
  port: 51234,
  token: 'a'.repeat(64),
  ...overrides,
});

describe('isUsableDiscovery', () => {
  it('takes a file this reporter understands', () => {
    expect(isUsableDiscovery(discovery())).toBe(true);
  });

  it('refuses a protocol it does not know', () => {
    expect(isUsableDiscovery(discovery({ version: INGEST_PROTOCOL_VERSION + 1 }))).toBe(false);
  });

  it('refuses a file missing either half of the address', () => {
    expect(isUsableDiscovery(discovery({ token: '' }))).toBe(false);
    expect(isUsableDiscovery(discovery({ port: 0 }))).toBe(false);
    expect(isUsableDiscovery(discovery({ port: 51234.5 }))).toBe(false);
  });

  it('refuses what is not a file at all', () => {
    expect(isUsableDiscovery(null)).toBe(false);
    expect(isUsableDiscovery('51234')).toBe(false);
  });
});

describe('ingestEndpoint', () => {
  it('is bound to the loopback address and nothing else', () => {
    expect(ingestEndpoint(51234)).toBe('http://127.0.0.1:51234/ingest');
  });
});
