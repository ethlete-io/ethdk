import { describe, expect, it } from 'vitest';
import { DEFAULT_GIT_FLOW_CONFIG, resolveGitFlowConfig } from './config';
import { resolveSeverity, validateBranch } from './validate';

const config = DEFAULT_GIT_FLOW_CONFIG;
const gated = resolveGitFlowConfig({ enforcement: 'gated', severity: { 'missing-key': 'error' } });

describe('validateBranch', () => {
  it('accepts a sub-feature merging into its parent', () => {
    const report = validateBranch({
      branch: 'sub/feat/FIP-2177-user-management/FIP-2178-user-password-reset',
      target: 'feat/FIP-2177-user-management',
      config,
    });

    expect(report).toMatchObject({ ok: true, blocked: false });
  });

  it('flags a sub-feature merged straight into next', () => {
    const report = validateBranch({
      branch: 'sub/feat/FIP-2177-user-management/FIP-2178-user-password-reset',
      target: 'next',
      config,
    });

    expect(report.findings).toEqual([
      {
        rule: 'wrong-mr-target',
        severity: 'warn',
        message: 'A sub-feature branch must merge into feat/FIP-2177-user-management, not next.',
        suggestion: 'feat/FIP-2177-user-management',
      },
    ]);
  });

  it('accepts a flat branch merging into an integration branch, dev-* included', () => {
    for (const target of ['dev-game-codes', 'feat/FIP-2177-user-management', 'next']) {
      const report = validateBranch({ branch: 'feat/logout-confirmation', target, config });

      expect(
        report.findings.map((finding) => finding.rule),
        target,
      ).not.toContain('wrong-mr-target');
    }
  });

  it('flags a feature branch aimed at production', () => {
    const report = validateBranch({ branch: 'feat/FIP-2177-user-management', target: 'main', config });

    expect(report.findings.map((finding) => finding.rule)).toEqual(['wrong-mr-target']);
  });

  it('lets a release merge into both base branches and a hotfix into production only', () => {
    expect(validateBranch({ branch: 'release/2026.04.28', target: 'main', config }).ok).toBe(true);
    expect(validateBranch({ branch: 'release/2026.04.28', target: 'next', config }).ok).toBe(true);
    expect(validateBranch({ branch: 'hotfix/FIP-2799-broken', target: 'main', config }).ok).toBe(true);
    expect(validateBranch({ branch: 'hotfix/FIP-2799-broken', target: 'next', config }).blocked).toBe(false);
    expect(validateBranch({ branch: 'hotfix/FIP-2799-broken', target: 'next', config }).findings).toHaveLength(1);
  });

  it('says nothing about the target of a branch it could not classify', () => {
    expect(validateBranch({ branch: 'wip', target: 'main', config }).findings.map((f) => f.rule)).toEqual([
      'unknown-type',
    ]);
  });

  it('blocks a direct push to a protected branch even in advisory mode', () => {
    const report = validateBranch({ branch: 'next', push: true, config });

    expect(config.enforcement).toBe('advisory');
    expect(report.blocked).toBe(true);
    expect(report.findings[0]).toMatchObject({ rule: 'protected-push', severity: 'error' });
  });

  it('does not report a protected push when nothing is being pushed', () => {
    expect(validateBranch({ branch: 'main', config }).ok).toBe(true);
  });
});

describe('resolveSeverity', () => {
  it('caps naming rules at warn while advisory, whatever the config says', () => {
    const loud = resolveGitFlowConfig({ severity: { 'missing-key': 'error', 'type-alias': 'error' } });

    expect(resolveSeverity({ rule: 'missing-key', config: loud })).toBe('warn');
    expect(resolveSeverity({ rule: 'type-alias', config: loud })).toBe('warn');
    expect(validateBranch({ branch: 'feat/logout-confirmation', config: loud }).blocked).toBe(false);
  });

  it('lets wrong-mr-target be promoted before the naming grace period ends', () => {
    const promoted = resolveGitFlowConfig({ severity: { 'wrong-mr-target': 'error' } });
    const report = validateBranch({
      branch: 'sub/feat/FIP-2177-user-management/FIP-2178-reset',
      target: 'next',
      config: promoted,
    });

    expect(promoted.enforcement).toBe('advisory');
    expect(report.blocked).toBe(true);
  });

  it('applies the configured severity once gated', () => {
    expect(resolveSeverity({ rule: 'missing-key', config: gated })).toBe('error');
    expect(validateBranch({ branch: 'feat/logout-confirmation', config: gated }).blocked).toBe(true);
  });

  it('honours a rule switched off', () => {
    const quiet = resolveGitFlowConfig({ severity: { 'deprecated-prefix': 'off' } });

    expect(validateBranch({ branch: 'dev-game-codes', config: quiet }).findings).toEqual([]);
  });
});
