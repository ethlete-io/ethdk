import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { copyPart } from './copy-part.mjs';

test('a copied part keeps its own relative imports and reaches files outside it from the new place', () => {
  const root = mkdtempSync(join(tmpdir(), 'copy-part-'));
  const part = join(root, 'design/studio/components/chip');
  const to = join(root, 'design/studio/sketches/components-chip/a/components/chip');

  mkdirSync(join(part, 'shared'), { recursive: true });
  writeFileSync(
    join(part, 'chip.ts'),
    "import { LABELS } from '../../../../apps/studio/labels';\nimport { tone } from './shared/tone';\n",
  );
  writeFileSync(join(part, 'shared/tone.ts'), "import { LABELS } from '../../../../../apps/studio/labels';\n");
  writeFileSync(join(part, 'chip.css'), '.chip {}\n');

  copyPart(part, to);

  assert.equal(
    readFileSync(join(to, 'chip.ts'), 'utf8'),
    "import { LABELS } from '../../../../../../../apps/studio/labels';\nimport { tone } from './shared/tone';\n",
  );
  assert.equal(
    readFileSync(join(to, 'shared/tone.ts'), 'utf8'),
    "import { LABELS } from '../../../../../../../../apps/studio/labels';\n",
  );
  assert.equal(readFileSync(join(to, 'chip.css'), 'utf8'), '.chip {}\n');
});
