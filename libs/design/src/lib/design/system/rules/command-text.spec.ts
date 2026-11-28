import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../design-config';
import { resolveProduct } from '../resolve-product';
import { commandTextOf } from './command-text';

const acme = (code: string, commandText?: 'deny') => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });

  const file = join(target, DESIGN_DIR, 'acme/pages/home/home.ts');

  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, code);

  return resolveProduct({
    target,
    name: 'acme',
    config: { ...readConfig(target)?.products?.['acme'], ...(commandText ? { commandText } : {}) },
  });
};

const hitsOf = (code: string, optIn = true) =>
  commandTextOf(acme(code, optIn ? 'deny' : undefined)).map((problem) => problem.message.split('`')[1]);

describe('commandTextOf', { timeout: 30_000 }, () => {
  it('reports a command in the visible text of a drawing', () => {
    expect(hitsOf('const a = `<p>Run npx nx build components first</p>`;\n')).toEqual([
      'Run npx nx build components first',
    ]);
  });

  it('reports a flag and an env assignment', () => {
    expect(hitsOf('const a = `<p>Pass --force</p><p>CI=true</p>`;\n')).toEqual(['Pass --force', 'CI=true']);
  });

  it('ignores attributes, plain prose and code outside markup', () => {
    expect(
      hitsOf('const a = `<p class="x" data-a="--b">Mocks are stale. Wait a moment</p>`;\nconst b = "yarn build";\n'),
    ).toEqual([]);
  });

  it('ignores a quoted > in an attribute, an Angular interpolation and a token name built from a hole', () => {
    expect(
      hitsOf("const a = `<div [class]=\"n > 0 ? 'a --b' : 'c'\">{{ n --x }}</div><span>--text-${step}</span>`;\n"),
    ).toEqual([]);
  });

  it('is off without the config flag', () => {
    expect(hitsOf('const a = `<p>npx nx build</p>`;\n', false)).toEqual([]);
  });
});
