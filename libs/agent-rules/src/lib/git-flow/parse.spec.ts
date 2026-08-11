import { describe, expect, it } from 'vitest';
import { buildBranchName, slugifySubject } from './build';
import { DEFAULT_GIT_FLOW_CONFIG, resolveGitFlowConfig } from './config';
import { GitFlowRule } from './config';
import { parseBranch, resolveThroughBase } from './parse';

const config = DEFAULT_GIT_FLOW_CONFIG;
const parse = (branch: string) => parseBranch({ branch, config });
const rules = (branch: string) => parse(branch).findings.map((finding) => finding.rule);

describe('parseBranch', () => {
  it('classifies the five conforming shapes', () => {
    expect(parse('feat/FIP-2177-user-management')).toMatchObject({
      ok: true,
      kind: 'main-feature',
      type: 'feat',
      storyKey: 'FIP-2177',
      issueKey: 'FIP-2177',
      subject: 'user-management',
      expectedBase: 'next',
      expectedMrTargets: ['next'],
    });

    expect(parse('feat/FIP-2177-user-management/FIP-2178-user-password-reset')).toMatchObject({
      ok: true,
      kind: 'sub-feature',
      storyKey: 'FIP-2177',
      taskKey: 'FIP-2178',
      issueKey: 'FIP-2178',
      subject: 'user-password-reset',
      parent: 'feat/FIP-2177-user-management',
      expectedBase: 'feat/FIP-2177-user-management',
      expectedMrTargets: ['feat/FIP-2177-user-management'],
    });

    expect(parse('release/2026.04.28')).toMatchObject({
      ok: true,
      kind: 'release',
      expectedBase: 'next',
      expectedMrTargets: ['next', 'main'],
    });

    expect(parse('release/2026.04.28/FIP-2222-button-not-visible')).toMatchObject({
      ok: true,
      kind: 'release-fix',
      taskKey: 'FIP-2222',
      parent: 'release/2026.04.28',
      expectedMrTargets: ['release/2026.04.28'],
    });

    expect(parse('hotfix/FIP-2799-password-recovery-broken')).toMatchObject({
      ok: true,
      kind: 'hotfix',
      taskKey: 'FIP-2799',
      issueKey: 'FIP-2799',
      expectedBase: 'main',
      expectedMrTargets: ['main'],
    });
  });

  it('reads dev-* as the deprecated spelling of a main feature branch, not as unknown', () => {
    const result = parse('dev-game-codes');

    expect(result).toMatchObject({
      kind: 'main-feature',
      deprecated: true,
      subject: 'game-codes',
      expectedBase: 'next',
      expectedMrTargets: ['next'],
      suggestedName: 'feat/<KEY>-game-codes',
    });
    expect(result.findings.map((finding) => finding.rule)).toEqual<GitFlowRule[]>(['deprecated-prefix']);
  });

  it('treats the base branches as protected rather than malformed', () => {
    expect(parse('next')).toMatchObject({ ok: true, kind: 'protected', expectedMrTargets: ['main'] });
    expect(parse('main')).toMatchObject({ ok: true, kind: 'protected', expectedMrTargets: ['next'] });
  });

  it('tolerates the naming zoo and reports what is off', () => {
    expect(rules('feature/FIP-2904-game-codes-detail-view')).toEqual<GitFlowRule[]>(['type-alias']);
    expect(parse('feature/FIP-2904-game-codes-detail-view')).toMatchObject({
      kind: 'main-feature',
      type: 'feat',
      storyKey: 'FIP-2904',
      suggestedName: 'feat/FIP-2904-game-codes-detail-view',
    });

    expect(rules('feature/FIP-2926')).toEqual<GitFlowRule[]>(['type-alias', 'missing-subject']);

    expect(parse('feat/fip-2762-managers-and-contacts-widget')).toMatchObject({
      kind: 'main-feature',
      storyKey: 'FIP-2762',
      suggestedName: 'feat/FIP-2762-managers-and-contacts-widget',
    });
    expect(rules('feat/fip-2762-managers-and-contacts-widget')).toEqual<GitFlowRule[]>(['key-case']);

    for (const branch of [
      'feat/collection-item-rejection-tooltip',
      'feat/logout-confirmation',
      'feat/system-stats-and-season-scoped-leagues',
      'refactor/hub-cdk-to-components',
    ]) {
      expect(parse(branch), branch).toMatchObject({ kind: 'main-feature', storyKey: undefined });
      expect(rules(branch), branch).toEqual<GitFlowRule[]>(['missing-key']);
    }
  });

  it('does not read a trailing number as an issue key', () => {
    const result = parse('fix/ratings-reveal-secondary-page-27');

    expect(result.storyKey).toBeUndefined();
    expect(result.subject).toBe('ratings-reveal-secondary-page-27');
    expect(result.suggestedName).toBeUndefined();
  });

  it('reports an unrecognised shape without throwing', () => {
    expect(parse('wip')).toMatchObject({ ok: false, kind: 'unknown', expectedMrTargets: [] });
    expect(rules('wip')).toEqual<GitFlowRule[]>(['unknown-type']);
    expect(rules('feat/FIP-1-a/FIP-2-b/FIP-3-c')).toEqual<GitFlowRule[]>(['unknown-type']);
    expect(rules('')).toEqual<GitFlowRule[]>(['unknown-type']);
    expect(rules('feat/')).toEqual<GitFlowRule[]>(['unknown-type']);
  });

  it('flags a release branch whose date is not a date', () => {
    expect(rules('release/next-sprint')).toEqual<GitFlowRule[]>(['release-date']);
    expect(parse('release/next-sprint')).toMatchObject({ kind: 'release' });
  });

  it('strips ref prefixes so remote refs parse', () => {
    expect(parse('refs/heads/feat/FIP-2177-user-management').branch).toBe('feat/FIP-2177-user-management');
    expect(parse('refs/remotes/origin/feat/FIP-2177-user-management')).toMatchObject({
      ok: true,
      branch: 'feat/FIP-2177-user-management',
      storyKey: 'FIP-2177',
    });
  });

  it('honours a repo-level config override', () => {
    const overridden = resolveGitFlowConfig({
      baseBranches: { development: 'develop' },
      types: ['feat'],
      keyPattern: 'ETH_\\d+',
    });

    expect(parseBranch({ branch: 'feat/ETH_12-thing', config: overridden })).toMatchObject({
      ok: true,
      storyKey: 'ETH_12',
      expectedBase: 'develop',
      expectedMrTargets: ['develop'],
    });
    expect(parseBranch({ branch: 'develop', config: overridden }).kind).toBe('protected');
    expect(parseBranch({ branch: 'refactor/x', config: overridden }).kind).toBe('unknown');
  });
});

describe('resolveThroughBase', () => {
  it('inherits the story key of the integration branch a keyless branch sits on', () => {
    const resolved = resolveThroughBase({
      branch: parse('feat/collection-item-rejection-tooltip'),
      base: parse('feat/FIP-2177-user-management'),
    });

    expect(resolved).toMatchObject({
      storyKey: 'FIP-2177',
      issueKey: 'FIP-2177',
      inheritedFrom: 'feat/FIP-2177-user-management',
    });
  });

  it('leaves a branch that names its own story alone', () => {
    const branch = parse('feat/FIP-2904-game-codes-detail-view');

    expect(resolveThroughBase({ branch, base: parse('feat/FIP-2177-user-management') }).storyKey).toBe('FIP-2904');
  });

  it('inherits nothing from a keyless base', () => {
    const branch = parse('feat/logout-confirmation');

    expect(resolveThroughBase({ branch, base: parse('dev-game-codes') })).toBe(branch);
  });
});

describe('buildBranchName', () => {
  it('builds every shape from the grammar', () => {
    expect(
      buildBranchName({ spec: { kind: 'main-feature', key: 'fip-2177', subject: 'User Management' }, config }),
    ).toBe('feat/FIP-2177-user-management');
    expect(
      buildBranchName({
        spec: {
          kind: 'sub-feature',
          parent: 'feat/FIP-2177-user-management',
          key: 'FIP-2178',
          subject: 'User password reset',
        },
        config,
      }),
    ).toBe('feat/FIP-2177-user-management/FIP-2178-user-password-reset');
    expect(buildBranchName({ spec: { kind: 'release', date: '2026.04.28' }, config })).toBe('release/2026.04.28');
    expect(
      buildBranchName({
        spec: { kind: 'release-fix', parent: 'release/2026.04.28', key: 'FIP-2222', subject: 'Button not visible' },
        config,
      }),
    ).toBe('release/2026.04.28/FIP-2222-button-not-visible');
    expect(
      buildBranchName({ spec: { kind: 'hotfix', key: 'FIP-2799', subject: 'Password recovery broken' }, config }),
    ).toBe('hotfix/FIP-2799-password-recovery-broken');
  });

  it('round-trips through the parser', () => {
    const name = buildBranchName({
      spec: { kind: 'main-feature', key: 'FIP-1', subject: 'Ünïcode & symbols!' },
      config,
    });

    expect(name).toBe('feat/FIP-1-n-code-symbols');
    expect(parse(name).ok).toBe(true);
  });

  it('slugifies to kebab case', () => {
    expect(slugifySubject('  User Management  ')).toBe('user-management');
    expect(slugifySubject('FIP/2177 — thing')).toBe('fip-2177-thing');
  });
});
