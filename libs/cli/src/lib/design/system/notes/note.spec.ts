import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../../paths';
import { addFlowNote, changeFlowNote, deleteFlowNote, listFlows } from '../flows/flow';
import { resolveProduct } from '../resolve-product';
import { changeNote, createNote, deleteNote, listNotes, MISSING_NOTE_SIZE } from './note';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-note-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  return resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
};

const on = { part: 'pages/home', state: 'empty' };

describe('state notes', () => {
  it('writes a note on a state, with or without a point, and lists it', () => {
    const product = acme();
    const pointed = createNote({
      product,
      note: { ...on, point: { x: 12, y: 30 }, size: 'phone', text: 'Say why it is empty.' },
    });
    const whole = createNote({ product, note: { ...on, text: 'The first visit.' } });

    if (typeof pointed === 'string' || typeof whole === 'string') throw new Error('not written');

    expect(JSON.parse(readFileSync(pointed.file, 'utf8'))).toEqual({
      ...on,
      point: { x: 12, y: 30 },
      size: 'phone',
      text: 'Say why it is empty.',
    });
    expect(listNotes(product.dir).notes.map(({ id, point, text }) => ({ id, point, text }))).toEqual(
      expect.arrayContaining([
        { id: pointed.id, point: { x: 12, y: 30 }, text: 'Say why it is empty.' },
        { id: whole.id, point: undefined, text: 'The first visit.' },
      ]),
    );
  });

  it('refuses a note on a missing part or state, or without a text', () => {
    const product = acme();

    expect(createNote({ product, note: { ...on, state: 'loading', text: 'x' } })).toBe(
      'pages/home has no state "loading"',
    );
    expect(createNote({ product, note: { ...on, part: 'pages/gone', text: 'x' } })).toBe(
      'part pages/gone no longer exists',
    );
    expect(createNote({ product, note: { ...on, text: '  ' } })).toBe('text must be a non-empty string');
    expect(createNote({ product, note: { ...on, point: { x: 1, y: 2 }, text: 'x' } })).toBe(MISSING_NOTE_SIZE);
    expect(createNote({ product, note: { ...on, point: { x: 1, y: 2 }, size: 'tablet', text: 'x' } })).toBe(
      'preset "tablet" no longer exists',
    );
    expect(existsSync(join(product.dir, 'notes'))).toBe(false);
  });

  it('changes the text and the point, drops the point and its size on null, and deletes a note', () => {
    const product = acme();
    const created = createNote({ product, note: { ...on, point: { x: 1, y: 2 }, size: 'phone', text: 'a' } });

    if (typeof created === 'string') throw new Error('not written');

    const { id } = created;

    expect(changeNote({ productDir: product.dir, id, change: { text: 'b' } })).toMatchObject({
      text: 'b',
      point: { x: 1, y: 2 },
      size: 'phone',
    });
    expect(
      changeNote({ productDir: product.dir, id, change: { point: { x: 3, y: 4 }, size: 'desktop' } }),
    ).toMatchObject({ point: { x: 3, y: 4 }, size: 'desktop' });
    expect(changeNote({ productDir: product.dir, id, change: { point: null } })).not.toHaveProperty('size');
    expect(JSON.parse(readFileSync(created.file, 'utf8'))).toEqual({ ...on, text: 'b' });
    expect(changeNote({ productDir: product.dir, id, change: { text: '' } })).toBe('text must be a non-empty string');
    expect(changeNote({ productDir: product.dir, id: '../x', change: { text: 'c' } })).toBe('"../x" is no note id');
    expect(deleteNote({ productDir: product.dir, id })).toMatchObject({ id });
    expect(existsSync(created.file)).toBe(false);
    expect(deleteNote({ productDir: product.dir, id })).toBe(`no note "${id}"`);
  });
});

describe('free notes in a flow', () => {
  const flowFile = (product: { dir: string }, body: unknown) => {
    const dir = join(product.dir, 'flows');

    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'browse.json'), typeof body === 'string' ? body : JSON.stringify(body, null, 2));

    return join(dir, 'browse.json');
  };

  it('adds, changes and deletes a free note and keeps every other key of the flow file', () => {
    const product = acme();
    const flow = { frames: [{ ...on, position: { x: 0, y: 0 } }], lines: [], owner: 'kept' };
    const file = flowFile(product, flow);
    const added = addFlowNote({
      productDir: product.dir,
      name: 'browse',
      note: { text: 'Browsing', at: { x: 0, y: -80 } },
    });

    if (typeof added === 'string') throw new Error(added);

    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ ...flow, notes: [added] });
    expect(listFlows(product.dir).flows[0]?.notes).toEqual([{ id: added.id, text: 'Browsing', at: { x: 0, y: -80 } }]);
    expect(
      changeFlowNote({ productDir: product.dir, name: 'browse', id: added.id, change: { text: 'Browse', at: null } }),
    ).toEqual({ id: added.id, text: 'Browse' });
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ ...flow, notes: [{ id: added.id, text: 'Browse' }] });
    expect(deleteFlowNote({ productDir: product.dir, name: 'browse', id: added.id })).toMatchObject({ id: added.id });
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(flow);
    expect(deleteFlowNote({ productDir: product.dir, name: 'browse', id: added.id })).toBe(
      `flow "browse" has no note "${added.id}"`,
    );
  });

  it('leaves a flow file it cannot read untouched, and refuses a bad flow name or note', () => {
    const product = acme();
    const file = flowFile(product, '{ "frames": [');

    expect(addFlowNote({ productDir: product.dir, name: 'browse', note: { text: 'x' } })).toMatch(
      /^flows\/browse\.json is no JSON - fix it first/,
    );
    expect(readFileSync(file, 'utf8')).toBe('{ "frames": [');
    expect(addFlowNote({ productDir: product.dir, name: '../browse', note: { text: 'x' } })).toBe(
      '"../browse" is no flow name',
    );
    expect(addFlowNote({ productDir: product.dir, name: 'gone', note: { text: 'x' } })).toBe('no flow "gone"');

    flowFile(product, { frames: [] });

    expect(addFlowNote({ productDir: product.dir, name: 'browse', note: { text: ' ' } })).toBe(
      'notes[0] must be { id, text, at?: { x, y } }, at in CSS pixels on the flow canvas',
    );
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ frames: [] });
  });
});
