import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR } from '../design-config';
import { Problem } from './problem';
import { resolveProduct } from './resolve-product';
import { RULE_BASELINE_FILE, ruleBaselineOf, writeRuleBaseline } from './rule-baseline';

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-rule-baseline-'));
  const write = (path: string, source: string) => {
    mkdirSync(dirname(join(target, path)), { recursive: true });
    writeFileSync(join(target, path), source);
  };

  for (const name of ['rail', 'chip'])
    write(`${DESIGN_DIR}/app-a/components/${name}/${name}.ts`, 'export default definePart({ states: {} });\n');

  write(`${DESIGN_DIR}/config.json`, JSON.stringify({ products: { 'app-a': {} } }));

  const git = (...args: string[]) => execFileSync('git', args, { cwd: target, stdio: 'pipe' }).toString();
  const commit = () => {
    git('add', '-A');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'x');
  };

  git('init', '-q');
  commit();

  const product = () => resolveProduct({ target, name: 'app-a', config: {} });
  const hitOn = (name: string, at: string): Problem => ({
    rule: 'CONTROL-STATE',
    file: join(target, DESIGN_DIR, `app-a/components/${name}/${name}.ts`),
    message: `control "${at}" is drawn markup`,
    at,
  });
  const file = join(target, DESIGN_DIR, 'app-a', RULE_BASELINE_FILE);
  const writeBaseline = (entries: Record<string, unknown>) => writeFileSync(file, `${JSON.stringify(entries)}\n`);

  return { product, hitOn, commit, writeBaseline, file };
};

const entry = { finding: '489', sketch: 'components/rail-bubble' };
const everywhere = () => true;

describe('rule baseline (ADR 0201)', () => {
  it('passes a baselined hit with its printed line, and fails a hit the baseline does not list', () => {
    const { product, hitOn, commit, writeBaseline } = checkout();

    writeBaseline({ 'CONTROL-STATE': { 'components/rail: section': entry } });
    commit();

    const found = ruleBaselineOf({
      product: product(),
      problems: [hitOn('rail', 'section'), hitOn('rail', 'product')],
      checked: everywhere,
    });

    expect(found.lines).toEqual([
      'baselined (ADR 0201): CONTROL-STATE components/rail: section - finding 489, sketch components/rail-bubble',
    ]);
    expect(found.problems).toEqual([hitOn('rail', 'product')]);
  });

  it('fails an entry that no longer hits where its rule ran, and keeps one its rule did not check', () => {
    const { product, commit, writeBaseline, file } = checkout();

    writeBaseline({ 'CONTROL-STATE': { 'components/rail: section': entry } });
    commit();

    expect(ruleBaselineOf({ product: product(), problems: [], checked: everywhere }).problems).toEqual([
      {
        rule: 'CONTROL-STATE',
        file,
        message: 'components/rail: section no longer hits - remove its entry (finding 489, ADR 0201)',
      },
    ]);
    expect(ruleBaselineOf({ product: product(), problems: [], checked: (rule) => rule !== 'CONTROL-STATE' })).toEqual({
      problems: [],
      lines: [],
    });
    expect(
      ruleBaselineOf({ product: product(), problems: [], checked: (_, part) => part === 'components/chip' }).problems,
    ).toEqual([]);
  });

  it('fails an entry added after the baseline was first committed, so the list only shrinks', () => {
    const { product, hitOn, commit, writeBaseline } = checkout();

    writeBaseline({ 'CONTROL-STATE': { 'components/rail: section': entry } });
    commit();
    writeBaseline({
      'CONTROL-STATE': { 'components/rail: section': entry, 'components/chip: remove': entry },
    });

    const found = ruleBaselineOf({
      product: product(),
      problems: [hitOn('rail', 'section'), hitOn('chip', 'remove')],
      checked: everywhere,
    });

    expect(found.problems.map((problem) => problem.message)).toEqual([
      'components/chip: remove was added to the rule baseline - it may only shrink (ADR 0201)',
    ]);
  });

  it('writes every hit under its rule and part, sorted, and keeps the entries already there', () => {
    const { product, hitOn, writeBaseline, file } = checkout();

    writeBaseline({ 'CONTROL-STATE': { 'components/rail: section': { finding: '1', sketch: 'x' } } });
    writeRuleBaseline({
      product: product(),
      problems: [hitOn('rail', 'product'), hitOn('rail', 'section'), { ...hitOn('chip', 'x'), rule: 'DROPPED-PROP' }],
      entry,
    });

    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({
      'CONTROL-STATE': {
        'components/rail: product': entry,
        'components/rail: section': { finding: '1', sketch: 'x' },
      },
      'DROPPED-PROP': { 'components/chip: x': entry },
    });
    expect(Object.keys(JSON.parse(readFileSync(file, 'utf8'))['CONTROL-STATE'])).toEqual([
      'components/rail: product',
      'components/rail: section',
    ]);
  });
});
