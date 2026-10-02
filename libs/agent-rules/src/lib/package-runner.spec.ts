import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { detectCommandVars, detectPackageRunner } from './package-runner';

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

describe('detectCommandVars', () => {
  it('runs the repo scripts through its package manager', () => {
    const root = repo({
      'package.json': JSON.stringify({ scripts: { lint: 'eslint .', storybook: 'storybook dev' } }),
      'yarn.lock': '',
    });

    expect(detectCommandVars(root)).toEqual({
      lintCommand: 'yarn run lint',
      lintFixCommand: 'yarn run lint --fix',
      storybookStartCommand: 'yarn run storybook',
    });
  });

  it('separates the fix flag for npm', () => {
    const root = repo({ 'package.json': JSON.stringify({ scripts: { lint: 'eslint .' } }) });

    expect(detectCommandVars(root)['lintFixCommand']).toBe('npm run lint -- --fix');
  });

  it('falls back to nx lint when there is no lint script', () => {
    const root = repo({ 'package.json': JSON.stringify({ devDependencies: { nx: '22.0.0' } }), 'pnpm-lock.yaml': '' });

    expect(detectCommandVars(root)).toEqual({
      lintCommand: 'pnpm exec nx lint <project>',
      lintFixCommand: 'pnpm exec nx lint <project> --fix',
    });
  });

  it('derives nothing without a script or nx', () => {
    expect(detectCommandVars(repo({ 'package.json': '{}' }))).toEqual({});
  });
});
