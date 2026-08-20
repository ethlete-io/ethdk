import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { loadApiDefinitions } from './load-definitions';

const rootWithModule = (fileName: string, source: string) => {
  const root = mkdtempSync(join(tmpdir(), 'cli-api-defs-'));

  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'host' }), 'utf8');
  writeFileSync(join(root, fileName), source, 'utf8');

  return root;
};

describe('loadApiDefinitions', () => {
  it('reports nothing found when the repo has no definitions file', () => {
    expect(loadApiDefinitions(mkdtempSync(join(tmpdir(), 'cli-api-defs-')))).toEqual({ found: false });
  });

  it('loads a commonjs module', () => {
    const root = rootWithModule('ethlete.apis.js', 'module.exports = { hub: { port: 8040 } };');
    const result = loadApiDefinitions(root);

    expect(result.fileName).toBe('ethlete.apis.js');
    expect(result.apis?.['hub']?.port).toBe(8040);
  });

  it('unwraps a default export', () => {
    const root = rootWithModule('ethlete.apis.js', 'module.exports = { default: { hub: { port: 1 } } };');

    expect(loadApiDefinitions(root).apis?.['hub']?.port).toBe(1);
  });

  it('keeps a function on a definition, which json could not hold', () => {
    const root = rootWithModule('ethlete.apis.js', "module.exports = { hub: { env: () => ({ A: 'b' }) } };");

    expect(loadApiDefinitions(root).apis?.['hub']?.env?.()).toEqual({ A: 'b' });
  });
});
