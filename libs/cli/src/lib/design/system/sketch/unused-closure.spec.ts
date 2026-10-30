import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, relative } from 'path';
import { describe, expect, it } from 'vitest';
import { ResolvedProduct } from '../resolve-product';
import { Sketch } from './sketch';
import { unusedInVariantOf } from './unused-closure';

const sketchWith = (files: Record<string, string>) => {
  const dir = mkdtempSync(join(tmpdir(), 'cli-design-unused-closure-'));

  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }

  return { dir, targets: ['pages/inbox'], variants: ['a'] } as unknown as Sketch;
};

const product = { parts: [] } as unknown as ResolvedProduct;

const linesOf = (sketch: Sketch) =>
  unusedInVariantOf({ product, sketch, variant: 'a' }).map(
    (problem) => `${problem.rule} ${relative(sketch.dir, problem.file)}: ${problem.message}`,
  );

const PART = `import { inbox } from '@shared/inbox';\n\nexport const page = () => inbox(true, 'l');\n`;

describe('unusedInVariantOf', () => {
  it('names the imports, parameters and classes of other candidates left in a shared helper', () => {
    const sketch = sketchWith({
      'a/pages/inbox/inbox.ts': PART,
      'shared/inbox.ts': [
        `import css from './inbox.css?inline';`,
        `import { svgAsset } from './assets';`,
        ``,
        `const row = (label: string, size: number) => \`<p>\${label}</p>\`;`,
        ``,
        `export const inbox = (open: boolean, placement: string, icon?: string) =>`,
        `  \`<style>\${css}</style><div class="inbox-\${placement}">\${icon ?? ''}\${row(String(open), 1)}</div>\`;`,
        ``,
      ].join('\n'),
      'shared/assets.ts': `export const svgAsset = (name: string) => name;\n`,
      'shared/inbox.css': `.inbox-l { gap: 1rem; }\n.legacy-rail { gap: 2rem; }\n.et-button { gap: 0; }\n`,
    });

    expect(linesOf(sketch)).toEqual([
      'UNUSED shared/inbox.ts: imports svgAsset but never uses it - remove the import',
      'UNUSED shared/inbox.ts: row takes size but never uses it - remove the parameter',
      'UNUSED shared/inbox.ts: no call of inbox passes icon - remove the parameter',
      'UNUSED shared/inbox.css: styles .legacy-rail, which nothing the variant draws uses - remove the rule',
    ]);
  });

  it('passes a variant whose closure holds only what it uses', () => {
    const sketch = sketchWith({
      'a/pages/inbox/inbox.ts': PART,
      'shared/inbox.ts': [
        `import css from './inbox.css?inline';`,
        ``,
        `export const inbox = (open: boolean, placement: string) =>`,
        `  \`<style>\${css}</style><div class="inbox-\${placement}" data-open="\${open}"></div>\`;`,
        ``,
      ].join('\n'),
      'shared/inbox.css': `.inbox-l { gap: 1rem; }\n`,
      'shared/unreached.ts': `import { nothing } from './nowhere';\n`,
    });

    expect(linesOf(sketch)).toEqual([]);
  });
});
