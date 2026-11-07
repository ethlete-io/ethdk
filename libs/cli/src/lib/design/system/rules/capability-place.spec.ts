import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { capabilityPlaceOf, capabilityPlaceVerdictOf, readCapabilities } from './capability-place';

const FILE = '/p/capabilities.json';

const declared = new Map([
  ['pages/sketches', ['emit:merge', 'open']],
  ['components/menu', ['emit:serverAction']],
]);

const verdictOf = (capabilities: unknown[]) => capabilityPlaceVerdictOf({ file: FILE, capabilities, declared });

const checkout = (capabilities: unknown) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-capability-place-'));
  const dir = join(target, DESIGN_DIR, 'app-a');

  mkdirSync(join(dir, 'pages/home'), { recursive: true });
  writeFileSync(
    join(dir, 'pages/home/home.ts'),
    `const later = '<button data-et-action="emit:later">';
export default definePart({ states: { a: {} }, render: () => ({ body: '<button data-et-action="emit:save">' }) });\n`,
  );
  writeFileSync(join(target, DESIGN_DIR, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));
  if (capabilities !== undefined) writeFileSync(join(dir, 'capabilities.json'), JSON.stringify(capabilities));

  return { target, product: resolveProduct({ target, name: 'app-a', config: {} }) };
};

describe('CAPABILITY-PLACE', () => {
  it('passes a capability whose place a part of the product declares', () => {
    expect(
      verdictOf([{ id: 'merge', label: 'Sketch mergen', place: { part: 'pages/sketches', action: 'emit:merge' } }]),
    ).toEqual({ errors: [], warnings: [] });
  });

  it('reads a dblclick: action as a literal action key of the part', () => {
    const verdict = capabilityPlaceVerdictOf({
      file: FILE,
      capabilities: [{ id: 'fit', label: 'Frame fit', place: { part: 'pages/sketches', action: 'dblclick:open' } }],
      declared: new Map([['pages/sketches', ['dblclick:open']]]),
    });

    expect(verdict).toEqual({ errors: [], warnings: [] });
  });

  it('lists an automatic capability with its why as a warning, and fails one without a why or with a place', () => {
    const verdict = verdictOf([
      { id: 'fit', label: 'Frame fit', place: null, automatic: true, why: 'ResizeObserver refits on resize' },
      { id: 'a', label: 'A', place: null, automatic: true },
      { id: 'b', label: 'B', place: { part: 'pages/sketches', action: 'open' }, automatic: true, why: 'x' },
    ]);

    expect(verdict.warnings.map((warning) => warning.message)).toEqual([
      'fit (Frame fit): automatic, no design action draws it - ResizeObserver refits on resize',
    ]);
    expect(verdict.errors.map((error) => error.message)).toEqual([
      'a (A): is automatic but gives no "why" - say what triggers it',
      'b (B): has a place but is marked automatic - remove "automatic"',
    ]);
  });

  it('fails a capability without a place that is not known as missing', () => {
    expect(verdictOf([{ id: 'comment-write', label: 'Kommentar schreiben', place: null }]).errors).toEqual([
      {
        rule: 'CAPABILITY-PLACE',
        file: FILE,
        message: 'comment-write (Kommentar schreiben): no design action draws it - give it a place {part, action}',
      },
    ]);
  });

  it('fails a place whose part or action the product does not have', () => {
    const { errors } = verdictOf([
      { id: 'a', label: 'A', place: { part: 'pages/gone', action: 'emit:merge' } },
      { id: 'b', label: 'B', place: { part: 'pages/sketches', action: 'emit:discard' } },
    ]);

    expect(errors.map((problem) => problem.message)).toEqual([
      'a (A): its place pages/gone is no part of the product',
      'b (B): pages/sketches declares no action "emit:discard" - its actions: emit:merge, open',
    ]);
  });

  it('warns a known missing capability, and fails one that has a place again', () => {
    const { errors, warnings } = verdictOf([
      { id: 'sketch-diff', label: 'Diff', place: null, missing: 'B151' },
      { id: 'server', label: 'Server', place: { part: 'components/menu', action: 'emit:serverAction' }, missing: 'B1' },
    ]);

    expect(warnings.map((problem) => problem.message)).toEqual([
      'sketch-diff (Diff): no design action yet, known and tracked in B151',
    ]);
    expect(errors.map((problem) => problem.message)).toEqual([
      'server (Server): has a place but is still marked missing (B1) - remove "missing"',
    ]);
  });

  it('fails a malformed entry and a repeated id', () => {
    const { errors } = verdictOf([
      { id: 'a', label: 'A', place: { part: 'pages/sketches', action: 'open' } },
      { id: 'a', label: 'A again', place: { part: 'pages/sketches', action: 'open' } },
      { id: 'b', place: 'pages/sketches' },
    ]);

    expect(errors.map((problem) => problem.message)).toEqual([
      'a: listed twice',
      'entry 3: needs an id, a label and a place that is {part, action} or null',
    ]);
  });

  it('reads no list for a product without capabilities.json, and fails one that is no list', () => {
    expect(readCapabilities(checkout(undefined).product.dir)).toBeNull();
    expect(readCapabilities(checkout({ capabilities: 'x' }).product.dir)).toMatchObject({
      rule: 'CAPABILITY-PLACE',
      message: 'capabilities.json needs a "capabilities" list',
    });
  });

  it('checks a place against the rendered actions and the literal ones of the part source', async () => {
    const { target, product } = checkout({
      capabilities: [
        { id: 'save', label: 'Speichern', place: { part: 'pages/home', action: 'emit:save' } },
        { id: 'later', label: 'Später', place: { part: 'pages/home', action: 'emit:later' } },
        { id: 'gone', label: 'Weg', place: { part: 'pages/home', action: 'emit:gone' } },
      ],
    });
    const load = vi.fn(async () => ({
      default: { states: { a: {} }, render: () => ({ body: '<button data-et-action="emit:save">' }) },
    }));

    const { errors } = await capabilityPlaceOf({ target, config: {}, product, load });

    expect(errors.map((problem) => problem.message)).toEqual([
      'gone (Weg): pages/home declares no action "emit:gone" - its actions: emit:later, emit:save',
    ]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('loads no part for a product without a list', async () => {
    const { target, product } = checkout(undefined);
    const load = vi.fn();

    expect(await capabilityPlaceOf({ target, config: {}, product, load })).toEqual({ errors: [], warnings: [] });
    expect(load).not.toHaveBeenCalled();
  });

  const repo = resolve(__dirname, '../../../../../../..');

  it.runIf(existsSync(join(repo, 'dist/libs/components')))(
    'reports the confirmed studio list: every place resolves, the known missing ones are warnings',
    async () => {
      const target = repo;
      const config = readConfig(target) ?? {};
      const product = resolveProduct({ target, name: 'studio', config: config.products?.['studio'] ?? {} });
      const listed = readCapabilities(product.dir);
      const missing = (Array.isArray(listed) ? listed : []).flatMap((entry) =>
        typeof entry === 'object' && entry !== null && 'missing' in entry && 'id' in entry ? [String(entry.id)] : [],
      );

      const { errors, warnings } = await capabilityPlaceOf({ target, config, product });

      expect(errors).toEqual([]);
      expect(missing.length).toBeGreaterThan(0);
      expect(warnings.map((problem) => problem.message.split(' ')[0])).toEqual(missing);

      const placed = (listed as { id: string; place: unknown }[]).find((entry) => entry.place !== null);
      const copy = mkdtempSync(join(tmpdir(), 'cli-design-capability-place-real-'));

      writeFileSync(
        join(copy, 'capabilities.json'),
        JSON.stringify({
          capabilities: (listed as { id: string }[]).map((entry) =>
            entry.id === placed?.id ? { ...entry, place: null } : entry,
          ),
        }),
      );

      const unplaced = await capabilityPlaceOf({ target, config, product: { ...product, dir: copy } });

      expect(unplaced.errors.map((problem) => problem.message.split(' ')[0])).toEqual([placed?.id]);
    },
    120_000,
  );
});
