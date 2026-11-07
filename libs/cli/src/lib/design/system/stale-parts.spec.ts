import { execFileSync } from 'child_process';
import { originOf } from './write-origin';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from '../design-config';
import { appFilesOf } from './app-files';
import { checkRules } from './check-system';
import { designHashOf } from './design-hash';
import { readyMarkOf, writePartRecord } from './part-ready';
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

const commitAt = (target: string, date: string) => {
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: target,
      stdio: 'pipe',
      env: { ...process.env, GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date },
    });

  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'x');
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

  it('marks a check record stale and names the file when an imported part changes, though the folder did not', () => {
    const { target, dir } = checkout();

    expect(writePartRecord({ product: productOf(target), part: CHIP, origin: originOf('spec') })).not.toBeNull();
    markImplemented({ product: productOf(target), part: CHIP, states: { default: {} } });

    const folder = partHashOf({ product: productOf(target), dir: join(dir, 'components/chip') });

    appendFileSync(join(target, 'libs/kit/design/index.ts'), '// moved\n');
    appendFileSync(join(dir, 'elements/icon/icon.ts'), '// moved\n');

    expect(partHashOf({ product: productOf(target), dir: join(dir, 'components/chip') })).toBe(folder);
    expect(readyMarkOf({ product: productOf(target), part: CHIP })).toBeNull();
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

    writePartRecord({ product: productOf(target), part: CHIP, origin: originOf('spec') });
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

  it('moves a check record stored before file lists to the design hash while its folder hash holds, else lists it stale', () => {
    const { target, dir } = checkout();
    const legacy = partHashOf({ product: productOf(target), dir: join(dir, 'components/chip') });
    const at = '2026-10-01T00:00:00.000Z';

    execFileSync('git', ['init', '-q'], { cwd: target });
    commitAt(target, '2026-09-01T00:00:00Z');

    writeFileSync(
      join(dir, 'ready.json'),
      JSON.stringify({ [CHIP]: { hash: legacy, at }, 'elements/icon': { hash: 'old', by: 'tom', at } }),
    );
    writeFileSync(join(dir, 'implemented.json'), JSON.stringify({ [CHIP]: { hash: legacy, at, states: {} } }));

    expect(upgradeLegacyMarksOf({ product: productOf(target) })).toEqual([
      { part: CHIP, marks: ['ready', 'implemented'] },
    ]);

    const now = designHashOf(chipOf(target));
    const ready = JSON.parse(readFileSync(join(dir, 'ready.json'), 'utf8')) as Record<string, unknown>;
    const implemented = JSON.parse(readFileSync(join(dir, 'implemented.json'), 'utf8')) as Record<string, unknown>;

    expect(ready[CHIP]).toEqual({ hash: now.hash, files: now.files, at });
    expect(ready['elements/icon']).toEqual({ hash: 'old', by: 'tom', at });
    expect(implemented[CHIP]).toEqual({ hash: now.hash, at, states: {}, app: expect.any(Object) });
    expect(readyMarkOf({ product: productOf(target), part: CHIP })).not.toBeNull();
    expect(stalePartsOf({ product: productOf(target) })).toEqual([
      { part: 'elements/icon', design: [UNLISTED_FILES], app: [] },
    ]);
  });

  it('lists a legacy record stale when a file it reaches outside its folder was committed after the record', () => {
    const { target, dir } = checkout();
    const legacy = partHashOf({ product: productOf(target), dir: join(dir, 'components/chip') });
    const at = '2026-10-01T00:00:00.000Z';

    execFileSync('git', ['init', '-q'], { cwd: target });
    commitAt(target, '2026-09-01T00:00:00Z');
    writeFileSync(join(dir, 'ready.json'), JSON.stringify({ [CHIP]: { hash: legacy, by: 'tom', at } }));
    appendFileSync(join(dir, 'elements/icon/icon.ts'), '// moved\n');
    commitAt(target, '2026-10-15T00:00:00Z');

    expect(upgradeLegacyMarksOf({ product: productOf(target) })).toEqual([]);
    expect(JSON.parse(readFileSync(join(dir, 'ready.json'), 'utf8'))[CHIP]).toEqual({ hash: legacy, by: 'tom', at });
  });

  it('fails check --rules --base on an app file of an implemented part changed in the range since its record', () => {
    const { target } = checkout();

    writePartRecord({ product: productOf(target), part: CHIP, origin: originOf('spec') });
    markImplemented({
      product: productOf(target),
      part: CHIP,
      states: { default: {} },
      app: appFilesOf({ root: target, component: 'apps/a/chip/chip.component.ts' }),
    });
    execFileSync('git', ['init', '-q'], { cwd: target });
    commitAt(target, '2026-09-01T00:00:00Z');
    appendFileSync(join(target, 'apps/a/chip/chip.component.html'), '<b aria-label="x"></b>\n');
    appendFileSync(join(target, 'libs/lib/src/unused.ts'), '// not reached\n');
    commitAt(target, '2026-09-02T00:00:00Z');

    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const config = { products: { 'app-a': {} } };
    const run = (base?: string) => {
      errors.mockClear();
      checkRules({ target, config, products: ['app-a'], base, invocation: 'et design' });

      return errors.mock.calls.map(([line]) => String(line)).filter((line) => line.startsWith('IMPLEMENTATION-'));
    };

    expect(run()).toEqual([]);
    expect(run('HEAD~1..HEAD')).toEqual([
      `IMPLEMENTATION-UNCOMPARED apps/a/chip/chip.component.html: changed since ${CHIP} was recorded as implemented (${
        JSON.parse(readFileSync(join(target, DESIGN_DIR, 'app-a/implemented.json'), 'utf8'))[CHIP].at
      }) - run et design compare --affected --product app-a to compare and record every affected part`,
    ]);
    vi.restoreAllMocks();
  });
});
