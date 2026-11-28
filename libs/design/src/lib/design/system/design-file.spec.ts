import { spawnSync } from 'child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { designContentOf, writeDesignFile } from './design-file';

const checkout = () => {
  const root = mkdtempSync(join(tmpdir(), 'cli-design-file-'));

  mkdirSync(join(root, '.ethlete/design/acme'), { recursive: true });
  writeFileSync(join(root, '.prettierrc'), '{ "printWidth": 120 }');
  writeFileSync(join(root, '.gitignore'), '.ethlete/design/*/pictures.json\n');
  spawnSync('git', ['init', '-q'], { cwd: root });

  return root;
};

const UNFORMATTED = `${JSON.stringify({ part: { actions: ['emit:a', 'emit:b'] } }, null, 2)}\n`;
const FORMATTED = '{\n  "part": {\n    "actions": ["emit:a", "emit:b"]\n  }\n}\n';

describe('the shared design write path', { timeout: 30_000 }, () => {
  it('writes a file under .ethlete/design formatted with the checkout Prettier config', () => {
    const file = join(checkout(), '.ethlete/design/acme/ready.json');

    writeDesignFile(file, UNFORMATTED);

    expect(readFileSync(file, 'utf8')).toBe(FORMATTED);
  });

  it('leaves files outside .ethlete/design, git-ignored files and types Prettier does not format as they are', () => {
    const root = checkout();
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

    expect(designContentOf(join(root, 'other/ready.json'), UNFORMATTED)).toBe(UNFORMATTED);
    expect(designContentOf(join(root, '.ethlete/design/acme/pictures.json'), UNFORMATTED)).toBe(UNFORMATTED);
    expect(designContentOf(join(root, '.ethlete/design/acme/shot.png'), png)).toBe(png);
  });

  it('leaves a design file outside a git checkout as it is, since no commit can carry it', () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-design-file-'));

    expect(designContentOf(join(root, '.ethlete/design/acme/ready.json'), UNFORMATTED)).toBe(UNFORMATTED);
  });

  it('keeps a file Prettier cannot parse as it is', () => {
    const file = join(checkout(), '.ethlete/design/acme/broken.ts');

    expect(designContentOf(file, 'const = ;\n')).toBe('const = ;\n');
  });
});
