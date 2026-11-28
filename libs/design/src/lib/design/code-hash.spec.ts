import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  actionCheckCodeOf,
  appPictureCodeOf,
  codeHashOf,
  codeModulesOf,
  COMPLETENESS_MODULES,
  designPictureCodeOf,
  RENDER_INSPECT_MODULES,
} from './code-hash';

describe('codeHashOf', () => {
  let root: string;
  const write = (file: string, text: string) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  };
  const hash = () => codeHashOf({ entries: ['producer'], root, assets: join(root, 'assets') });

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'code-hash-'));
    write('producer.ts', "import { a } from './system/helper';\nimport { recordCache } from './timings';\n");
    write(
      'system/helper.ts',
      "import { Shape } from '../shape';\nimport type { Other } from '../unrelated';\nimport { createDesignServer } from '../serve';\n",
    );
    write('shape.ts', 'export type Shape = 1;');
    write('serve.ts', "import { other } from './behind-hub';");
    write('behind-hub.ts', 'one');
    write('timings.ts', 'one');
    write('unrelated.ts', 'one');
    write('assets/frame.css', 'one');
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('follows the imports of its entries, a hub counted but not followed, recording and type imports left out', () => {
    expect([...codeModulesOf(['producer'], root).keys()]).toEqual(['producer', 'serve', 'system/helper']);
  });

  it('keeps its hash over an edit of a file its entries do not run, and changes it on an edit of one they do', () => {
    const before = hash();

    for (const file of ['unrelated.ts', 'timings.ts', 'behind-hub.ts', 'shape.ts']) {
      write(file, 'export type Shape = 2;');

      expect(hash(), file).toBe(before);
    }

    for (const file of ['serve.ts', 'system/helper.ts', 'assets/frame.css', 'producer.ts']) {
      const prior = hash();

      write(file, `${file} edited`);

      expect(hash(), file).not.toBe(prior);
    }
  });

  it('follows a module the built cli requires', () => {
    write('built.js', 'const helper_1 = require("./system/helper");');

    expect([...codeModulesOf(['built'], root).keys()]).toEqual(['built', 'serve', 'system/helper']);
  });
});

describe('the code each compare cache is keyed on', () => {
  const modulesOf = (entries: string[]) => [...codeModulesOf(entries).keys()];

  it('holds the shot, the harness shot and the action check, and none of the commands or the run records', () => {
    const design = modulesOf(['serve', 'shot', 'thumb', 'render']);
    const app = modulesOf(['system/harness-shot', 'system/compare-cache']);
    const actions = modulesOf(['system/actions-command', 'system/action-cache']);

    expect(design).toEqual(expect.arrayContaining(['serve', 'shot', 'thumb', 'render']));
    expect(app).toEqual(expect.arrayContaining(['system/harness-shot', 'shot', 'thumb', 'system/part-compare']));
    expect(actions).toEqual(
      expect.arrayContaining(['system/actions-command', 'system/live-actions', 'system/harness-shot']),
    );

    for (const modules of [design, app, actions])
      for (const unrelated of [
        'timings',
        'timings-command',
        'design-command',
        'system/compare-command',
        'inbox-command',
      ])
        expect(modules).not.toContain(unrelated);
  });

  it('hashes each cache apart', () => {
    expect(new Set([designPictureCodeOf(), appPictureCodeOf(), actionCheckCodeOf()]).size).toBe(3);
  });
});

describe('the code each check cache is keyed on', () => {
  it('leaves out the check command, the system list and auto-accept, so an edit of those redraws nothing', () => {
    for (const entries of [RENDER_INSPECT_MODULES, COMPLETENESS_MODULES]) {
      const modules = [...codeModulesOf(entries).keys()];

      expect(modules).toEqual(expect.arrayContaining(['shot', 'system/served-cache']));
      for (const unrelated of [
        'system/check-system',
        'system/list-system',
        'system/accepted-pictures',
        'system/slow-run',
        'design-command',
        'timings',
      ])
        expect(modules).not.toContain(unrelated);
    }
  });
});
