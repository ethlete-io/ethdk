import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR } from '../paths';
import { appFilesOf } from './app-files';
import { designHashOf } from './design-hash';
import { goStateOf, markPartGo } from './part-go';
import { doneParts, markImplemented } from './part-task';
import { partKeyOf, resolveProduct } from './resolve-product';
import { partHashOf } from './sketch/baseline';
import { staleLineOf, stalePartsOf, UNLISTED_FILES, upgradeLegacyMarksOf } from './stale-parts';

const CHIP = 'components/chip';

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-stale-parts-'));
  const design = join(target, DESIGN_DIR);
  const write = (path: string, source: string) => {
    mkdirSync(dirname(join(target, path)), { recursive: true });
    writeFileSync(join(target, path), source);
  };

  write(
    `${DESIGN_DIR}/app-a/components/chip/chip.ts`,
    [
      "import { icon } from '@system/elements/icon';",
      "import { mock } from '@ethlete/kit/design';",
      "export default definePart({ implements: 'apps/a/chip/chip.component.ts', states: { default: {} } });",
      '',
    ].join('\n'),
  );
  write(`${DESIGN_DIR}/app-a/elements/icon/icon.ts`, 'export default definePart({ states: { default: {} } });\n');
  write('libs/kit/design/index.ts', "export const mock = 'kit';\n");
  write(
    'tsconfig.base.json',
    `// paths\n${JSON.stringify({ compilerOptions: { paths: { '@x/lib': ['libs/lib/src/index.ts'] } } })}`,
  );
  write('libs/lib/src/index.ts', "export * from './used';\nexport * from './unused';\n");
  write('libs/lib/src/used.ts', "import { helper } from './helper';\nexport const used = helper;\n");
  write('libs/lib/src/helper.ts', 'export const helper = 1;\n');
  write('libs/lib/src/unused.ts', 'export const unused = 2;\n');
  write(
    'apps/a/chip/chip.component.ts',
    [
      "import { used } from '@x/lib';",
      "@Component({ templateUrl: './chip.component.html', styleUrl: './chip.component.css' })",
      'export class ChipComponent { value = used; }',
      '',
    ].join('\n'),
  );
  write('apps/a/chip/chip.component.html', '<span></span>\n');
  write('apps/a/chip/chip.component.css', 'span {}\n');
  writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));

  return { target, dir: join(design, 'app-a') };
};

const productOf = (target: string) => resolveProduct({ target, name: 'app-a', config: {} });

const chipOf = (target: string) => {
  const product = productOf(target);
  const part = product.parts.find((candidate) => partKeyOf(candidate) === CHIP);

  if (!part) throw new Error('no chip');

  return { product, part };
};

describe('transitive part hash', () => {
  it('covers the imported parts, the SDK design mocks and the folder', () => {
    const { target } = checkout();

    expect(Object.keys(designHashOf(chipOf(target)).files)).toEqual([
      `${DESIGN_DIR}/app-a/components/chip/chip.ts`,
      `${DESIGN_DIR}/app-a/elements/icon/icon.ts`,
      'libs/kit/design/index.ts',
    ]);
  });

  it('marks a go stale and names the file when an imported part changes, though the folder did not', () => {
    const { target, dir } = checkout();

    expect(markPartGo({ product: productOf(target), part: CHIP, by: 'tom' })).not.toHaveProperty('status');
    markImplemented({ product: productOf(target), part: CHIP, states: { default: {} } });

    const folder = partHashOf({ product: productOf(target), dir: join(dir, 'components/chip') });

    appendFileSync(join(target, 'libs/kit/design/index.ts'), '// moved\n');
    appendFileSync(join(dir, 'elements/icon/icon.ts'), '// moved\n');

    expect(partHashOf({ product: productOf(target), dir: join(dir, 'components/chip') })).toBe(folder);
    expect(goStateOf({ product: productOf(target), part: CHIP })).toBe('stale');
    expect(stalePartsOf({ product: productOf(target) })).toEqual([
      { part: CHIP, design: [`${DESIGN_DIR}/app-a/elements/icon/icon.ts`, 'libs/kit/design/index.ts'], app: [] },
    ]);
  });

  it('reaches only the barrel files that declare the imported names, plus template and styles', () => {
    const { target } = checkout();

    expect(Object.keys(appFilesOf({ root: target, component: 'apps/a/chip/chip.component.ts' }))).toEqual([
      'apps/a/chip/chip.component.css',
      'apps/a/chip/chip.component.html',
      'apps/a/chip/chip.component.ts',
      'libs/lib/src/helper.ts',
      'libs/lib/src/used.ts',
    ]);
  });

  it('marks a done part stale when a file its app component reaches changes', () => {
    const { target } = checkout();

    markPartGo({ product: productOf(target), part: CHIP, by: 'tom' });
    markImplemented({
      product: productOf(target),
      part: CHIP,
      states: { default: {} },
      app: appFilesOf({ root: target, component: 'apps/a/chip/chip.component.ts' }),
    });
    appendFileSync(join(target, 'libs/lib/src/unused.ts'), '// not reached\n');

    expect(stalePartsOf({ product: productOf(target) })).toEqual([]);

    appendFileSync(join(target, 'libs/lib/src/helper.ts'), '// moved\n');

    const stale = stalePartsOf({ product: productOf(target) });

    expect(stale).toEqual([{ part: CHIP, design: [], app: ['libs/lib/src/helper.ts'] }]);
    expect(staleLineOf('app-a', stale[0] ?? { part: '', design: [], app: [] })).toBe(
      `STALE app-a ${CHIP}: app libs/lib/src/helper.ts`,
    );
    expect(doneParts({ product: productOf(target), parts: [CHIP] })).toEqual([]);
  });

  it('moves a go stored before file lists to the design hash while its folder hash holds, else lists it stale', () => {
    const { target, dir } = checkout();
    const legacy = partHashOf({ product: productOf(target), dir: join(dir, 'components/chip') });
    const at = '2026-10-01T00:00:00.000Z';

    writeFileSync(
      join(dir, 'go.json'),
      JSON.stringify({ [CHIP]: { hash: legacy, by: 'tom', at }, 'elements/icon': { hash: 'old', by: 'tom', at } }),
    );
    writeFileSync(join(dir, 'implemented.json'), JSON.stringify({ [CHIP]: { hash: legacy, at, states: {} } }));
    writeFileSync(join(dir, 'ready.json'), JSON.stringify({ 'elements/icon': { hash: 'old', by: 'tom', at } }));

    expect(goStateOf({ product: productOf(target), part: CHIP })).toBe('current');
    expect(upgradeLegacyMarksOf({ product: productOf(target) })).toEqual([
      { part: CHIP, marks: ['go', 'implemented'] },
    ]);

    const now = designHashOf(chipOf(target));
    const go = JSON.parse(readFileSync(join(dir, 'go.json'), 'utf8')) as Record<string, unknown>;
    const implemented = JSON.parse(readFileSync(join(dir, 'implemented.json'), 'utf8')) as Record<string, unknown>;

    expect(go[CHIP]).toEqual({ hash: now.hash, files: now.files, by: 'tom', at });
    expect(go['elements/icon']).toEqual({ hash: 'old', by: 'tom', at });
    expect(implemented[CHIP]).toEqual({ hash: now.hash, at, states: {}, app: expect.any(Object) });
    expect(goStateOf({ product: productOf(target), part: CHIP })).toBe('current');
    expect(stalePartsOf({ product: productOf(target) })).toEqual([
      { part: 'elements/icon', design: [UNLISTED_FILES], app: [] },
    ]);
  });
});
