import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { createSketch, Sketch } from '../sketch/sketch';
import {
  commentsOnSketch,
  createComment,
  deleteComment,
  DesignComment,
  lastWordOf,
  listComments,
  replyToComment,
} from './comment';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-comment-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  return target;
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const on = { part: 'pages/home', state: 'empty', size: 'phone', text: 'Say why it is empty.' };

describe('createComment', () => {
  it('writes one JSON file per comment under comments/', () => {
    const target = acme();
    const product = resolveAcme(target);
    const comment = createComment({ product, comment: { ...on, point: { x: 120, y: 40 } } }) as DesignComment;

    expect(comment.file).toBe(join(target, DESIGN_DIR, 'acme/comments', `${comment.id}.json`));
    expect(JSON.parse(readFileSync(comment.file, 'utf8'))).toEqual({
      ...on,
      point: { x: 120, y: 40 },
      createdAt: expect.any(String),
    });
  });

  it('takes a preset, a width or fitted as the size', () => {
    const product = resolveAcme(acme());

    expect(createComment({ product, comment: { ...on, size: 'fitted' } })).toMatchObject({ size: 'fitted' });
    expect(createComment({ product, comment: { ...on, size: 0 } })).toContain('size must be');
    expect(createComment({ product, comment: { ...on, size: '' } })).toContain('size must be');
  });

  it('refuses a comment that points at nothing', () => {
    const product = resolveAcme(acme());

    expect(createComment({ product, comment: { ...on, part: 'pages/about' } })).toBe(
      'part pages/about no longer exists',
    );
    expect(createComment({ product, comment: { ...on, state: 'error' } })).toBe('pages/home has no state "error"');
    expect(createComment({ product, comment: { ...on, size: 'tablet' } })).toBe('preset "tablet" no longer exists');
    expect(createComment({ product, comment: { ...on, text: '' } })).toBe('text must be a non-empty string');
    expect(createComment({ product, comment: { ...on, point: { x: -1, y: 0 } } })).toContain('point must be');
    expect(createComment({ product, comment: { ...on, sketch: { target: 'pages/home', variant: 'a' } } })).toBe(
      'the sketch on pages/home no longer exists',
    );
  });

  it('resolves the part in a sketch variant', () => {
    const target = acme();
    const product = resolveAcme(target);
    const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'banner' }, variants: ['a'] }) as Sketch;
    const comment = { part: 'elements/banner', state: 'default', size: 'desktop', text: 'Taller.' };

    expect(createComment({ product, comment })).toBe('part elements/banner no longer exists');
    expect(
      createComment({ product, comment: { ...comment, sketch: { target: 'elements/banner', variant: 'b' } } }),
    ).toBe('the sketch on elements/banner has no variant "b"');

    const made = createComment({ product, comment: { ...comment, sketch: { target: sketch.target, variant: 'a' } } });

    expect(commentsOnSketch({ productDir: product.dir, product: 'acme', sketch: 'elements/banner' })).toEqual([made]);
  });
});

describe('the interaction of a comment', () => {
  const onButton = { part: 'components/button', state: 'default', size: 'fitted', text: 'Too dark.' };

  it('stores a forced interaction, leaves rest out of the file and reads a file without it as rest', () => {
    const product = resolveAcme(acme());
    const hover = createComment({ product, comment: { ...onButton, interaction: 'hover' } }) as DesignComment;
    const rest = createComment({ product, comment: { ...onButton, interaction: 'rest' } }) as DesignComment;
    const old = createComment({ product, comment: onButton }) as DesignComment;

    expect(JSON.parse(readFileSync(hover.file, 'utf8'))).toMatchObject({ interaction: 'hover' });
    expect(JSON.parse(readFileSync(rest.file, 'utf8'))).not.toHaveProperty('interaction');
    expect([hover.interaction, rest.interaction, old.interaction]).toEqual(['hover', 'rest', 'rest']);
    expect(
      listComments({ productDir: product.dir, product: 'acme' }).comments.map((comment) => comment.interaction),
    ).toEqual(['hover', 'rest', 'rest']);
  });

  it('refuses an unknown interaction and one the part does not declare', () => {
    const product = resolveAcme(acme());

    expect(createComment({ product, comment: { ...onButton, interaction: 'pressed' } })).toContain(
      'interaction must be rest or one of hover',
    );
    expect(createComment({ product, comment: { ...on, interaction: 'hover' } })).toBe(
      'pages/home has no interaction "hover"',
    );
  });
});

describe('listComments and deleteComment', () => {
  it('lists oldest first, reports a broken file, and deletes by id', () => {
    const target = acme();
    const product = resolveAcme(target);
    const first = createComment({ product, comment: on }) as DesignComment;
    const second = createComment({ product, comment: { ...on, state: 'default' } }) as DesignComment;
    const dir = join(product.dir, 'comments');

    writeFileSync(first.file, JSON.stringify({ ...on, createdAt: '2026-10-28T00:00:00.000Z' }));
    writeFileSync(join(dir, 'broken.json'), '{');

    const listed = listComments({ productDir: product.dir, product: 'acme' });

    expect(listed.comments.map((comment) => comment.id)).toEqual([second.id, first.id]);
    expect(listed.unreadable).toEqual([
      { file: join(dir, 'broken.json'), problem: expect.stringContaining('is no JSON') },
    ]);

    const products = [{ name: 'acme', dir: product.dir }];

    expect(deleteComment({ products, id: second.id })).toEqual(expect.objectContaining({ id: second.id }));
    expect(existsSync(second.file)).toBe(false);
    expect(deleteComment({ products, id: second.id })).toBe(`no open comment "${second.id}"`);
    expect(deleteComment({ products, id: '../x' })).toBe('"../x" is no comment id');
  });
});

describe('replyToComment', () => {
  it('appends replies to the thread and reads a file without replies as an empty list', () => {
    const target = acme();
    const product = resolveAcme(target);
    const comment = createComment({ product, comment: on }) as DesignComment;
    const products = [{ name: 'acme', dir: product.dir }];

    expect(comment.replies).toEqual([]);
    expect(lastWordOf(comment)).toBe('user');

    const answered = replyToComment({ products, id: comment.id, by: 'agent', text: 'Which part?' }) as DesignComment;

    expect(lastWordOf(answered)).toBe('agent');
    replyToComment({ products, id: comment.id, by: 'user', text: 'The title.' });

    const [listed] = listComments({ productDir: product.dir, product: 'acme' }).comments;

    expect(listed?.text).toBe(on.text);
    expect(listed?.replies).toEqual([
      { by: 'agent', text: 'Which part?', createdAt: expect.any(String) },
      { by: 'user', text: 'The title.', createdAt: expect.any(String) },
    ]);
    expect(lastWordOf(listed as DesignComment)).toBe('user');
    expect(replyToComment({ products, id: comment.id, by: 'agent', text: ' ' })).toBe('a reply needs a text');
    expect(replyToComment({ products, id: 'nope', by: 'agent', text: 'Hi.' })).toBe('no open comment "nope"');

    writeFileSync(comment.file, JSON.stringify({ ...on, createdAt: 'x', replies: [{ by: 'bot', text: 'Hi.' }] }));
    expect(listComments({ productDir: product.dir, product: 'acme' }).unreadable).toEqual([
      { file: comment.file, problem: expect.stringContaining('replies must be') },
    ]);
  });
});
