import { readFileSync } from 'fs';
import { join } from 'path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SHEBANG = '#!/usr/bin/env node';

describe('the et bin', () => {
  const manifest = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as {
    bin: Record<string, string>;
  };
  const entry = join(__dirname, '..', manifest.bin['et'] ?? '').replace(/\.js$/, '.ts');

  it('points at the entry that runs the cli', () => {
    expect(entry).toBe(join(__dirname, 'index.ts'));
  });

  it('keeps a node shebang through the build, so a package manager can run it', () => {
    const configPath = join(__dirname, '..', 'tsconfig.lib.json');
    const config = ts.getParsedCommandLineOfConfigFile(
      configPath,
      {},
      { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined },
    );
    const output = ts.transpileModule(readFileSync(entry, 'utf8'), { compilerOptions: config?.options }).outputText;

    expect(output.split('\n')[0]).toBe(SHEBANG);
  });
});
