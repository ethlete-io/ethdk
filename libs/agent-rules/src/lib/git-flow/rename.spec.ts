import { describe, expect, it } from 'vitest';
import { DEFAULT_GIT_FLOW_CONFIG, resolveGitFlowConfig } from './config';
import { conformingNameFor } from './rename';

const config = DEFAULT_GIT_FLOW_CONFIG;

describe('conformingNameFor', () => {
  it('rebuilds a keyless main feature from its type and subject', () => {
    expect(conformingNameFor({ branch: 'feat/user-management', key: 'FIP-2177', config })).toEqual({
      ok: true,
      name: 'feat/FIP-2177-user-management',
    });
  });

  it('keeps the type an alias resolves to', () => {
    expect(conformingNameFor({ branch: 'feature/user-management', key: 'FIP-2177', config })).toEqual({
      ok: true,
      name: 'feat/FIP-2177-user-management',
    });
  });

  it('uppercases the key it is given', () => {
    expect(conformingNameFor({ branch: 'feat/user-management', key: 'fip-2177', config })).toEqual({
      ok: true,
      name: 'feat/FIP-2177-user-management',
    });
  });

  it('slugifies a subject that is not kebab-case', () => {
    expect(conformingNameFor({ branch: 'feat/User Management', key: 'FIP-2177', config })).toEqual({
      ok: true,
      name: 'feat/FIP-2177-user-management',
    });
  });

  it('rebuilds a keyless hotfix', () => {
    expect(conformingNameFor({ branch: 'hotfix/broken-login', key: 'FIP-3', config })).toEqual({
      ok: true,
      name: 'hotfix/FIP-3-broken-login',
    });
  });

  it('fills the placeholder of a deprecated shape', () => {
    expect(conformingNameFor({ branch: 'dev-user-management', key: 'FIP-2177', config })).toEqual({
      ok: true,
      name: 'feat/FIP-2177-user-management',
    });
  });

  it('moves a too-deep nested branch under the sub prefix and gives its leaf the key', () => {
    expect(conformingNameFor({ branch: 'feat/FIP-1-parent/my-work', key: 'FIP-2', config })).toEqual({
      ok: true,
      name: 'sub/feat/FIP-1-parent/FIP-2-my-work',
    });
  });

  it('needs no key when the deprecated shape already carries one', () => {
    const shaped = resolveGitFlowConfig({
      deprecatedShapes: [
        { match: '^wip/(?<key>[A-Z]+-\\d+)-(?<subject>.+)$', kind: 'main-feature', renameTo: 'feat/<KEY>-<subject>' },
      ],
    });

    expect(conformingNameFor({ branch: 'wip/FIP-9-thing', config: shaped })).toEqual({
      ok: true,
      name: 'feat/FIP-9-thing',
    });
  });

  it('reports a conforming branch rather than renaming it', () => {
    expect(conformingNameFor({ branch: 'feat/FIP-2177-user-management', key: 'FIP-2177', config })).toEqual({
      ok: false,
      reason: 'already-conforms',
    });
  });

  it('reports a protected branch as conforming, so repair never touches it', () => {
    expect(conformingNameFor({ branch: 'main', key: 'FIP-1', config })).toEqual({
      ok: false,
      reason: 'already-conforms',
    });
    expect(conformingNameFor({ branch: 'next', key: 'FIP-1', config })).toEqual({
      ok: false,
      reason: 'already-conforms',
    });
  });

  it('asks for a key when the shape is rebuildable but none was given', () => {
    expect(conformingNameFor({ branch: 'feat/user-management', config })).toEqual({ ok: false, reason: 'needs-key' });
  });

  it('probes with a prefix the repo accepts', () => {
    const scoped = resolveGitFlowConfig({ keyPrefixes: ['FIP'] });

    expect(conformingNameFor({ branch: 'feat/user-management', config: scoped })).toEqual({
      ok: false,
      reason: 'needs-key',
    });
  });

  it('refuses a name that matches no shape, with or without a key', () => {
    expect(conformingNameFor({ branch: 'user-management', key: 'FIP-1', config })).toEqual({
      ok: false,
      reason: 'no-shape',
    });
    expect(conformingNameFor({ branch: 'user-management', config })).toEqual({ ok: false, reason: 'no-shape' });
  });

  it('refuses a branch whose type segment is not a known type', () => {
    expect(conformingNameFor({ branch: 'wip/user-management', key: 'FIP-1', config })).toEqual({
      ok: false,
      reason: 'no-shape',
    });
  });
});
