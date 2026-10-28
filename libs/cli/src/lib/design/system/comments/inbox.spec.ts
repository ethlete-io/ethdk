import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { createSketch, decideSketch, markSketchReady, Sketch } from '../sketch/sketch';
import { addressComment, createComment, DesignComment, replyToComment, resolveComment } from './comment';
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

  it('leaves an addressed and a resolved comment thread out', () => {
    const { target, comment } = setup();
    const products = [{ name: 'acme', dir: dirname(dirname(comment.file)) }];
    const comments = () => {
      const { items, waiting } = inboxOf({ target, config: readConfig(target) ?? {} });

      return [...items, ...waiting].filter((item) => item.kind === 'comment');
    };

    addressComment({ products, id: comment.id, author: 'gpt-5.6-sol' });

    expect(comments()).toEqual([]);

    resolveComment({ products, id: comment.id });

    expect(comments()).toEqual([]);
  });

  it('lists open comments of all products, and the decisions as waiting for the user, oldest first', () => {
    const { target, comment } = setup();
    const { items, waiting, unreadable } = inboxOf({ target, config: readConfig(target) ?? {} });

    expect(unreadable).toEqual([]);
    expect(items).toEqual([
      expect.objectContaining({
        kind: 'comment',
        id: comment.id,
        product: 'acme',
        file: `.ethlete/design/acme/comments/${comment.id}.json`,
      }),
    ]);
    expect(waiting).toEqual([
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
    expect(inboxOf({ target, config: readConfig(target) ?? {}, products: ['acme-base'] }).waiting).toHaveLength(1);
  });

  it('prints each item with the command that settles it', () => {
    const { target, comment } = setup();
    const text = inboxText(inboxOf({ target, config: readConfig(target) ?? {} }), 'et design');

    expect(text.split('\n')).toEqual([
      `2020-01-01 09:00  acme  comment ${comment.id}  pages/home · empty · phone · at 12,30`,
      '    Say why.',
      `    reply: et design comment reply ${comment.id} --product acme --by <model id> "…"`,
      `    done: et design inbox done ${comment.id} --note "…" --by <model id>`,
      '',
      'waiting for the user:',
      '2026-10-27 10:00  acme  pick elements/hero variant b',
      '    Calmer.',
      '    the user merges it in Studio - do not run sketch merge',
      '2026-10-27 11:00  acme-base  discard components/card',
      '    the user discards it in Studio',
    ]);
    expect(inboxText({ items: [], waiting: [] }, 'et design')).toBe('inbox empty');
  });

  it('lists a sketch whose baseline is stale as needing a rebase, with the changed parts', () => {
    const { target } = setup();
    const productDir = join(target, '.ethlete/design/acme');
    const home = join(productDir, 'sketches/pages-home/sketch.json');
    const unbased = JSON.parse(readFileSync(home, 'utf8')) as Record<string, unknown>;

    delete unbased['baseline'];

    writeFileSync(join(productDir, 'elements/hero/hero.css'), '.acme-hero { padding: 0; }');
    writeFileSync(home, JSON.stringify({ ...unbased, createdAt: '2026-10-27T12:00:00.000Z' }));

    const inbox = inboxOf({ target, config: readConfig(target) ?? {} });

    expect(inbox.items.filter((item) => item.kind === 'rebase')).toEqual([
      { kind: 'rebase', product: 'acme', target: 'pages/home', changed: [], at: '2026-10-27T12:00:00.000Z' },
      expect.objectContaining({ product: 'acme', target: 'elements/hero', changed: ['elements/hero'] }),
    ]);

    const text = inboxText(inbox, 'et design');

    expect(text).toContain(
      [
        '2026-10-27 12:00  acme  needs rebase pages/home: it records no baseline',
        '    bring each variant up to date, then run: et design sketch rebase pages/home --product acme --by <model id>',
      ].join('\n'),
    );
    expect(text).toContain('  acme  needs rebase elements/hero: elements/hero changed in the product');
  });

  it("moves a thread whose last word is the agent's to waiting, and back once the user replies", () => {
    const { target, comment } = setup();
    const products = [{ name: 'acme', dir: join(target, '.ethlete/design/acme') }];
    const inbox = () => inboxOf({ target, config: readConfig(target) ?? {} });

    vi.setSystemTime('2026-10-27T12:00:00Z');
    replyToComment({ products, id: comment.id, by: 'agent', author: 'gpt-5.6-sol', text: 'Which part?' });

    expect(inbox().items).toEqual([]);
    expect(inbox().waiting.filter((item) => item.kind === 'comment')).toEqual([
      expect.objectContaining({
        id: comment.id,
        at: '2026-10-27T12:00:00.000Z',
        threadState: 'answered',
        replies: [{ by: 'agent', author: 'gpt-5.6-sol', text: 'Which part?', createdAt: '2026-10-27T12:00:00.000Z' }],
      }),
    ]);
    expect(inboxText(inbox(), 'et design').split('\n').slice(-6)).toEqual([
      `2026-10-27 12:00  acme  comment ${comment.id} (answered)  pages/home · empty · phone · at 12,30`,
      '    Say why.',
      '    agent gpt-5.6-sol:',
      '      Which part?',
      `    reply: et design comment reply ${comment.id} --product acme --by <model id> "…"`,
      `    done: et design inbox done ${comment.id} --note "…" --by <model id>`,
    ]);

    vi.setSystemTime('2026-10-27T13:00:00Z');
    replyToComment({ products, id: comment.id, by: 'user', text: 'The title.' });

    expect(inbox().waiting.map((item) => item.kind)).toEqual(['pick', 'discard']);
    expect(inbox().items[0]).toEqual(
      expect.objectContaining({ id: comment.id, at: '2026-10-27T13:00:00.000Z', threadState: 'agent' }),
    );
  });

  it('marks a waiting thread whose last agent reply asks the user as a question', () => {
    const { target, comment } = setup();
    const products = [{ name: 'acme', dir: join(target, '.ethlete/design/acme') }];

    vi.setSystemTime('2026-10-27T12:00:00Z');
    replyToComment({
      products,
      id: comment.id,
      by: 'agent',
      author: 'gpt-5.6-sol',
      text: 'Which part?',
      question: true,
    });

    const inbox = inboxOf({ target, config: readConfig(target) ?? {} });

    expect(inbox.waiting.filter((item) => item.kind === 'comment')).toEqual([
      expect.objectContaining({ id: comment.id, threadState: 'question' }),
    ]);
    expect(inboxText(inbox, 'et design').split('\n').slice(-6, -3)).toEqual([
      `2026-10-27 12:00  acme  comment ${comment.id} (question)  pages/home · empty · phone · at 12,30`,
      '    Say why.',
      '    agent gpt-5.6-sol asks:',
    ]);
  });
});
