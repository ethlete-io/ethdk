import { describe, expect, it } from 'vitest';
import { CollectedEvent, GitCheckoutEvent, GitCommitEvent } from '../model/event';
import { dedupeKeyOf } from './dedupe';

const commit = (overrides: Partial<GitCommitEvent> = {}): GitCommitEvent => ({
  at: new Date(2026, 7, 11, 11, 30),
  source: 'git',
  kind: 'git-commit',
  repoPath: '/home/tom/dev/fut-frontend',
  branch: 'feat/FIP-2177-user-management',
  sha: 'abc1234',
  subject: 'feat(user): Add the invite flow',
  ...overrides,
});

const checkout = (overrides: Partial<GitCheckoutEvent> = {}): GitCheckoutEvent => ({
  at: new Date(2026, 7, 11, 9, 15),
  source: 'git',
  kind: 'git-checkout',
  repoPath: '/home/tom/dev/fut-frontend',
  branch: 'feat/FIP-2177-user-management',
  ...overrides,
});

describe('dedupeKeyOf', () => {
  it('keys a commit the same way on every rescan', () => {
    expect(dedupeKeyOf(commit())).toBe(dedupeKeyOf(commit()));
  });

  it('keys a commit by its sha, so the branch the first scan reported stays', () => {
    expect(dedupeKeyOf(commit({ branch: 'next' }))).toBe(dedupeKeyOf(commit()));
  });

  it('separates the same sha in two repositories', () => {
    expect(dedupeKeyOf(commit({ repoPath: '/home/tom/dev/ethlete-sdk' }))).not.toBe(dedupeKeyOf(commit()));
  });

  it('separates two commits in one repository', () => {
    expect(dedupeKeyOf(commit({ sha: 'def5678' }))).not.toBe(dedupeKeyOf(commit()));
  });

  it('keys a checkout by the instant HEAD moved and where it moved to', () => {
    expect(dedupeKeyOf(checkout())).toBe(dedupeKeyOf(checkout()));
    expect(dedupeKeyOf(checkout({ branch: 'next' }))).not.toBe(dedupeKeyOf(checkout()));
    expect(dedupeKeyOf(checkout({ at: new Date(2026, 7, 11, 9, 16) }))).not.toBe(dedupeKeyOf(checkout()));
  });

  it('never keys a commit and a checkout alike', () => {
    expect(dedupeKeyOf(checkout())).not.toBe(dedupeKeyOf(commit()));
  });

  it('leaves an observation only its collector could have made unkeyed', () => {
    const focus: CollectedEvent = {
      at: new Date(2026, 7, 11, 9, 30),
      source: 'window',
      kind: 'window-focus',
      appId: 'code',
      title: 'dedupe.ts - ethlete-sdk',
    };

    expect(dedupeKeyOf(focus)).toBeNull();
    expect(dedupeKeyOf({ at: new Date(), source: 'idle', kind: 'idle-start' })).toBeNull();
  });
});
