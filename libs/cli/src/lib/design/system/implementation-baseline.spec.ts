import { execFileSync } from 'child_process';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from '../design-config';
import { appFilesOf } from './app-files';
import { checkRules } from './check-system';
import { addedBaselineEntriesOf, IMPLEMENTATION_BASELINE_FILE } from './implementation-baseline';
import { writePartRecord } from './part-ready';
import { markImplemented } from './part-task';
import { resolveProduct } from './resolve-product';
import { originOf } from './write-origin';

const CHIP = 'components/chip';
const BADGE = 'components/badge';
const CHIP_HTML = 'apps/a/chip/chip.component.html';
const BADGE_HTML = 'apps/a/badge/badge.component.html';

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-implementation-baseline-'));
  const write = (path: string, source: string) => {
    mkdirSync(dirname(join(target, path)), { recursive: true });
    writeFileSync(join(target, path), source);
  };

  for (const name of ['chip', 'badge']) {
    write(
      `${DESIGN_DIR}/app-a/components/${name}/${name}.ts`,
      `export default definePart({ implements: 'apps/a/${name}/${name}.component.ts', states: { default: {} } });\n`,
    );
    write(
      `apps/a/${name}/${name}.component.ts`,
      `@Component({ templateUrl: './${name}.component.html' })\nexport class C {}\n`,
    );
    write(`apps/a/${name}/${name}.component.html`, '<span></span>\n');
  }

  writeFileSync(join(target, DESIGN_DIR, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));

  const product = () => resolveProduct({ target, name: 'app-a', config: {} });

  for (const name of ['chip', 'badge']) {
    writePartRecord({ product: product(), part: `components/${name}`, origin: originOf('spec') });
    markImplemented({
      product: product(),
      part: `components/${name}`,
      states: { default: {} },
      app: appFilesOf({ root: target, component: `apps/a/${name}/${name}.component.ts` }),
    });
  }

  const git = (...args: string[]) => execFileSync('git', args, { cwd: target, stdio: 'pipe' }).toString();
  const commit = () => {
    git('add', '-A');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'x');
  };

  git('init', '-q');
  commit();

  const baselineFile = join(target, DESIGN_DIR, 'app-a', IMPLEMENTATION_BASELINE_FILE);
  const writeBaseline = (entries: Record<string, unknown>) =>
    writeFileSync(baselineFile, `${JSON.stringify(entries, null, 2)}\n`);
  const hashOf = (path: string) =>
    appFilesOf({ root: target, component: path.replace('.html', '.ts') })[path] as string;

  return { target, commit, writeBaseline, baselineFile, hashOf };
};

const run = (target: string) => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const logs = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  const status = checkRules({
    target,
    config: { products: { 'app-a': {} } },
    products: ['app-a'],
    base: 'HEAD~1',
    invocation: 'et design',
  });
  const lines = (spy: typeof errors) => spy.mock.calls.map(([line]) => String(line));

  return {
    status,
    problems: lines(errors).filter((line) => line.startsWith('IMPLEMENTATION-')),
    baselined: lines(logs).filter((line) => line.startsWith('baselined')),
  };
};

afterEach(() => vi.restoreAllMocks());

describe('implementation baseline (ADR 0205)', () => {
  it('lets a baselined part pass with its pinned drift and prints the entry, while an unlisted part still fails', () => {
    const { target, commit, writeBaseline, hashOf } = checkout();

    appendFileSync(join(target, CHIP_HTML), '<b></b>\n');
    appendFileSync(join(target, BADGE_HTML), '<i></i>\n');
    writeBaseline({ [CHIP]: { finding: '495', app: { [CHIP_HTML]: hashOf(CHIP_HTML) } } });
    commit();

    const { status, problems, baselined } = run(target);

    expect(baselined).toEqual([`baselined (ADR 0205): ${CHIP} - finding 495`]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(new RegExp(`^IMPLEMENTATION-UNCOMPARED ${BADGE_HTML}: changed since ${BADGE}`));
    expect(status).toBe(1);
  });

  it('fails a baselined part that drifts beyond its pin', () => {
    const { target, commit, writeBaseline, hashOf } = checkout();

    appendFileSync(join(target, CHIP_HTML), '<b></b>\n');
    writeBaseline({ [CHIP]: { finding: '495', app: { [CHIP_HTML]: hashOf(CHIP_HTML) } } });
    commit();
    appendFileSync(join(target, CHIP_HTML), '<u></u>\n');
    commit();

    const { status, problems, baselined } = run(target);

    expect(baselined).toEqual([`baselined (ADR 0205): ${CHIP} - finding 495`]);
    expect(problems).toEqual([
      expect.stringMatching(
        new RegExp(`^IMPLEMENTATION-UNCOMPARED ${CHIP_HTML}: changed since ${CHIP} was baselined for finding 495`),
      ),
    ]);
    expect(status).toBe(1);
  });

  it('fails an entry whose part is no longer uncompared, so the list shrinks', () => {
    const { target, commit, writeBaseline } = checkout();

    writeBaseline({ [CHIP]: { finding: '495', app: { [CHIP_HTML]: '0000000000000000' } } });
    commit();

    const { status, problems } = run(target);

    expect(problems).toEqual([
      `IMPLEMENTATION-UNCOMPARED ${DESIGN_DIR}/app-a/${IMPLEMENTATION_BASELINE_FILE}: ${CHIP} is no longer uncompared - remove its entry (finding 495)`,
    ]);
    expect(status).toBe(1);
  });

  it('fails an entry added after the baseline was first committed, and one removed and added back', () => {
    const { target, commit, writeBaseline, baselineFile, hashOf } = checkout();
    const chip = () => ({ finding: '495', app: { [CHIP_HTML]: hashOf(CHIP_HTML) } });
    const badge = () => ({ finding: '495', app: { [BADGE_HTML]: hashOf(BADGE_HTML) } });

    appendFileSync(join(target, CHIP_HTML), '<b></b>\n');
    appendFileSync(join(target, BADGE_HTML), '<i></i>\n');
    writeBaseline({ [CHIP]: chip() });

    expect(addedBaselineEntriesOf({ file: baselineFile })).toEqual([]);

    commit();
    writeBaseline({ [CHIP]: chip(), [BADGE]: badge() });

    expect(addedBaselineEntriesOf({ file: baselineFile })).toEqual([BADGE]);

    commit();

    expect(addedBaselineEntriesOf({ file: baselineFile })).toEqual([BADGE]);

    const { status, problems } = run(target);

    expect(problems).toContain(
      `IMPLEMENTATION-UNCOMPARED ${DESIGN_DIR}/app-a/${IMPLEMENTATION_BASELINE_FILE}: ${BADGE} was added to the baseline - it may only shrink (ADR 0205)`,
    );
    expect(status).toBe(1);

    writeBaseline({ [BADGE]: badge() });

    expect(addedBaselineEntriesOf({ file: baselineFile })).toEqual([BADGE]);

    writeBaseline({});
    commit();
    writeBaseline({ [CHIP]: chip() });

    expect(addedBaselineEntriesOf({ file: baselineFile })).toEqual([CHIP]);
    expect(JSON.parse(readFileSync(baselineFile, 'utf8'))).toEqual({ [CHIP]: chip() });
  });

  it('fails a pin changed after the baseline was committed', () => {
    const { target, commit, writeBaseline, baselineFile, hashOf } = checkout();

    appendFileSync(join(target, CHIP_HTML), '<b></b>\n');
    writeBaseline({ [CHIP]: { finding: '495', app: { [CHIP_HTML]: hashOf(CHIP_HTML) } } });
    commit();
    appendFileSync(join(target, CHIP_HTML), '<u></u>\n');
    writeBaseline({ [CHIP]: { finding: '495', app: { [CHIP_HTML]: hashOf(CHIP_HTML) } } });

    expect(addedBaselineEntriesOf({ file: baselineFile })).toEqual([CHIP]);
    rmSync(baselineFile);
    expect(addedBaselineEntriesOf({ file: baselineFile })).toEqual([]);
  });
});
