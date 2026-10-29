import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { carryShared } from './merge-shared';
import { Sketch } from './sketch';

describe('carryShared', () => {
  it("takes the picked variant's own shared/ file over the sketch's", () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-design-merge-shared-'));
    const sketch = { dir: join(root, 'sketch') } as Sketch;
    const targetDir = join(root, 'part');

    [join(sketch.dir, 'shared'), join(sketch.dir, 'b/shared'), targetDir].forEach((dir) =>
      mkdirSync(dir, { recursive: true }),
    );
    writeFileSync(join(sketch.dir, 'shared/pin.ts'), 'export const pin = "sketch";\n');
    writeFileSync(join(sketch.dir, 'shared/list.ts'), 'export const list = 1;\n');
    writeFileSync(join(sketch.dir, 'b/shared/pin.ts'), 'export const pin = "b";\n');
    writeFileSync(join(targetDir, 'part.ts'), "import { pin } from '@shared/pin';\n");

    carryShared({ sketch, variant: 'b', targetDir });

    expect(readFileSync(join(targetDir, 'shared/pin.ts'), 'utf8')).toContain('"b"');
    expect(readFileSync(join(targetDir, 'shared/list.ts'), 'utf8')).toContain('list');
    expect(readFileSync(join(targetDir, 'part.ts'), 'utf8')).toContain("'./shared/pin'");
  });
});
