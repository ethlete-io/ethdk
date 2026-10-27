import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { createSketch, decideSketch, markSketchReady, Sketch } from '../sketch/sketch';
import { createComment, DesignComment, replyToComment } from './comment';
import { inboxOf, inboxText } from './inbox';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-inbox-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  return target;
};

const resolveNamed = (target: string, name: string) =>
  resolveProduct({ target, name, config: readConfig(target)?.products?.[name] ?? {} });

const setup = () => {
  const target = acme();
  const acmeProduct = resolveNamed(target, 'acme');
  const base = resolveNamed(target, 'acme-base');
  const hero = createSketch({
    product: acmeProduct,
    sketch: { layer: 'elements', name: 'hero' },
    variants: ['a', 'b'],
  }) as Sketch;
  const card = createSketch({
    product: base,
    sketch: { layer: 'components', name: 'card' },
    variants: ['a'],
  }) as Sketch;
  const comment = createComment({
    product: acmeProduct,
    comment: { part: 'pages/home', state: 'empty', size: 'phone', point: { x: 12, y: 30 }, text: 'Say why.' },
  }) as DesignComment;

  const stored = JSON.parse(readFileSync(comment.file, 'utf8')) as object;

  writeFileSync(comment.file, JSON.stringify({ ...stored, createdAt: '2020-01-01T09:00:00.000Z' }));
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime('2026-10-27T10:00:00Z');
  decideSketch({
    sketch: markSketchReady({ checkout: target, sketch: hero }) as Sketch,
    decision: { kind: 'pick', variant: 'b', comment: 'Calmer.' },
  });
  vi.setSystemTime('2026-10-27T11:00:00Z');
  decideSketch({ sketch: card, decision: { kind: 'discard' } });
  createSketch({ product: acmeProduct, sketch: { layer: 'pages', name: 'home' }, variants: ['a'] });

  return { target, comment };
};

describe('inboxOf', () => {
  afterEach(() => vi.useRealTimers());

  it('lists open comments and open decisions of all products, oldest first', () => {
    const { target, comment } = setup();
    const { items, unreadable } = inboxOf({ target, config: readConfig(target) ?? {} });

    expect(unreadable).toEqual([]);
    expect(items).toEqual([
      expect.objectContaining({
        kind: 'comment',
        id: comment.id,
        product: 'acme',
        file: `.ethlete/design/acme/comments/${comment.id}.json`,
      }),
      {
        kind: 'pick',
        product: 'acme',
        target: 'elements/hero',
        variant: 'b',
        comment: 'Calmer.',
        at: '2026-10-27T10:00:00.000Z',
      },
      { kind: 'discard', product: 'acme-base', target: 'components/card', at: '2026-10-27T11:00:00.000Z' },
    ]);
    expect(inboxOf({ target, config: readConfig(target) ?? {}, products: ['acme-base'] }).items).toHaveLength(1);
  });

  it('prints each item with the command that settles it', () => {
    const { target, comment } = setup();
    const text = inboxText(inboxOf({ target, config: readConfig(target) ?? {} }), 'et design');

    expect(text.split('\n')).toEqual([
      `2020-01-01 09:00  acme  comment ${comment.id}  pages/home · empty · phone · at 12,30`,
      '    Say why.',
      `    reply: et design comment reply ${comment.id} --product acme --by <model id> "…"`,
      `    done: et design inbox done ${comment.id} --note "…" --by <model id>`,
      '2026-10-27 10:00  acme  pick elements/hero variant b',
      '    Calmer.',
      '    run: et design sketch merge elements/hero --product acme --note "…" --by <model id>',
      '2026-10-27 11:00  acme-base  discard components/card',
      '    run: et design sketch discard components/card --product acme-base --by <model id>',
    ]);
    expect(inboxText({ items: [], waiting: [] }, 'et design')).toBe('inbox empty');
  });

  it("moves a thread whose last word is the agent's to waiting, and back once the user replies", () => {
    const { target, comment } = setup();
    const products = [{ name: 'acme', dir: join(target, '.ethlete/design/acme') }];
    const inbox = () => inboxOf({ target, config: readConfig(target) ?? {} });

    vi.setSystemTime('2026-10-27T12:00:00Z');
    replyToComment({ products, id: comment.id, by: 'agent', author: 'gpt-5.6-sol', text: 'Which part?' });

    expect(inbox().items.map((item) => item.kind)).toEqual(['pick', 'discard']);
    expect(inbox().waiting).toEqual([
      expect.objectContaining({
        id: comment.id,
        at: '2026-10-27T12:00:00.000Z',
        replies: [{ by: 'agent', author: 'gpt-5.6-sol', text: 'Which part?', createdAt: '2026-10-27T12:00:00.000Z' }],
      }),
    ]);
    expect(inboxText(inbox(), 'et design').split('\n').slice(-8)).toEqual([
      '',
      'waiting for the user:',
      `2026-10-27 12:00  acme  comment ${comment.id}  pages/home · empty · phone · at 12,30`,
      '    Say why.',
      '    agent gpt-5.6-sol:',
      '      Which part?',
      `    reply: et design comment reply ${comment.id} --product acme --by <model id> "…"`,
      `    done: et design inbox done ${comment.id} --note "…" --by <model id>`,
    ]);

    vi.setSystemTime('2026-10-27T13:00:00Z');
    replyToComment({ products, id: comment.id, by: 'user', text: 'The title.' });

    expect(inbox().waiting).toEqual([]);
    expect(inbox().items[2]).toEqual(expect.objectContaining({ id: comment.id, at: '2026-10-27T13:00:00.000Z' }));
  });
});
