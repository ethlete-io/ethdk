import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { detectPackageRunner } from './package-runner';

const repo = (files: Record<string, string>) => {
  const root = mkdtempSync(join(tmpdir(), 'agent-rules-runner-'));

  for (const [name, content] of Object.entries(files)) writeFileSync(join(root, name), content);

  return root;
};

describe('detectPackageRunner', () => {
  it('follows the declared packageManager over a lockfile', () => {
    const root = repo({ 'package.json': JSON.stringify({ packageManager: 'pnpm@9.1.0' }), 'yarn.lock': '' });

    expect(detectPackageRunner(root)).toBe('pnpm exec');
  });

  it('falls back to the lockfile', () => {
    expect(detectPackageRunner(repo({ 'package.json': '{}', 'yarn.lock': '' }))).toBe('yarn');
    expect(detectPackageRunner(repo({ 'bun.lock': '' }))).toBe('bunx');
  });

  it('uses npx without either', () => {
    expect(detectPackageRunner(repo({ 'package.json': '{}' }))).toBe('npx');
  });
});
