import { describe, expect, it } from 'vitest';
import { DEFAULT_GIT_FLOW_CONFIG, resolveGitFlowConfig } from './config';
import { planStart } from './start';

const config = DEFAULT_GIT_FLOW_CONFIG;

describe('planStart', () => {
  it('plans a main feature off the development branch', () => {
    expect(planStart({ spec: { kind: 'main-feature', key: 'FIP-2177', subject: 'User Management' }, config })).toEqual({
      branch: 'feat/FIP-2177-user-management',
      base: 'next',
      mrTargets: ['next'],
      problems: [],
      parse: expect.objectContaining({ kind: 'main-feature', storyKey: 'FIP-2177' }),
    });
  });

  it('nests a sub-feature under its parent and targets it', () => {
    const plan = planStart({
      spec: {
        kind: 'sub-feature',
        parent: 'feat/FIP-2177-user-management',
        key: 'FIP-2178',
        subject: 'user password reset',
      },
      config,
    });

    expect(plan).toMatchObject({
      branch: 'sub/feat/FIP-2177-user-management/FIP-2178-user-password-reset',
      base: 'feat/FIP-2177-user-management',
      mrTargets: ['feat/FIP-2177-user-management'],
      problems: [],
    });
    expect(plan.parse.storyKey).toBe('FIP-2177');
  });

  it('bases a hotfix on production and a release fix on its release', () => {
    expect(planStart({ spec: { kind: 'hotfix', key: 'FIP-2799', subject: 'password broken' }, config })).toMatchObject({
      branch: 'hotfix/FIP-2799-password-broken',
      base: 'main',
      mrTargets: ['main'],
    });
    expect(
      planStart({
        spec: { kind: 'release-fix', parent: 'release/2026.04.28', key: 'FIP-2222', subject: 'button' },
        config,
      }),
    ).toMatchObject({ branch: 'sub/release/2026.04.28/FIP-2222-button', base: 'release/2026.04.28' });
  });

  it('refuses a key the project prefixes reject', () => {
    const scoped = resolveGitFlowConfig({ keyPrefixes: ['FIP'] });
    const plan = planStart({ spec: { kind: 'main-feature', key: 'TOP-105', subject: 'list' }, config: scoped });

    expect(plan.problems).toHaveLength(1);
    expect(plan.problems[0]).toContain('carries no story issue key');
  });

  it('refuses to nest under a non-conforming parent', () => {
    const plan = planStart({
      spec: { kind: 'sub-feature', parent: 'dev-game-codes', key: 'FIP-2178', subject: 'reset' },
      config,
    });

    expect(plan.problems[0]).toBe('"sub/dev-game-codes/FIP-2178-reset" parses as unknown, not sub-feature.');
  });

  it('refuses a subject that slugifies to nothing', () => {
    const plan = planStart({ spec: { kind: 'main-feature', key: 'FIP-2177', subject: '???' }, config });

    expect(plan.branch).toBe('feat/FIP-2177');
    expect(plan.problems[0]).toContain('has no subject');
  });

  it('carries both release targets so the caller can show them', () => {
    expect(planStart({ spec: { kind: 'release', date: '2026.04.28' }, config })).toMatchObject({
      branch: 'release/2026.04.28',
      base: 'next',
      mrTargets: ['next', 'main'],
      problems: [],
    });
  });

  it('refuses a malformed release date', () => {
    expect(planStart({ spec: { kind: 'release', date: 'april' }, config }).problems[0]).toContain(
      'is not a release date',
    );
  });
});
