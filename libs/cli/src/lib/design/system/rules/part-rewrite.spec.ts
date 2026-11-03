import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { partRewritesIn, partRewritesOf } from './part-rewrite';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-part-rewrite-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });

  return target;
};

const write = (target: string, path: string, content: string) => {
  mkdirSync(dirname(join(target, DESIGN_DIR, path)), { recursive: true });
  writeFileSync(join(target, DESIGN_DIR, path), content);
};

const productOf = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const BARE_COMMENT_DRAFT = `import { commentDraft } from '@system/components/comment-draft';

const CARD =
  'rounded-md border border-(--et-surface-border-solid) bg-(--et-surface-background-solid) p-space-3 shadow-lg';

export const bareCommentDraft = async (text: string) => {
  const draft = await commentDraft({ text });
  return { body: draft.body.replace(CARD, 'p-space-3'), styles: draft.styles };
};
`;

describe('partRewritesIn', () => {
  it('names a replace on the markup an imported part drew, as in the inbox sketch of 153ca659d', () => {
    expect(partRewritesIn(BARE_COMMENT_DRAFT)).toEqual([
      { line: 8, part: 'components/comment-draft', call: 'replace(CARD)' },
    ]);
  });

  it('follows destructuring, a default import, awaits and class strings', () => {
    const source = [
      "import card, { CARD_CLASS } from '@system/components/card';",
      "import * as chip from '@system/components/chip';",
      'const { body } = await card.render({});',
      "export const a = body.replaceAll('<div', '<section');",
      "export const b = CARD_CLASS.replace('shadow-lg', '');",
      "export const c = (await chip.chip({})).body.replace(/x/u, '');",
    ].join('\n');

    expect(partRewritesIn(source).map(({ line, part }) => `${line} ${part}`)).toEqual([
      '4 components/card',
      '5 components/card',
      '6 components/chip',
    ]);
  });

  it('leaves a replace alone on own strings, packages, stylesheets and type-only imports', () => {
    const source = [
      "import { button } from '@ethlete/design';",
      "import styles from '@system/components/card/card.css';",
      "import type { Card } from '@system/components/card';",
      "const own = '<div>';",
      "export const a = own.replace('<div', '<section');",
      "export const b = button({}).replace('<button', '<button data-x');",
      "export const c = styles.replace('a', 'b');",
      "export const d = ({} as Card).body?.replace('a', 'b');",
    ].join('\n');

    expect(partRewritesIn(source)).toEqual([]);
  });
});

describe('partRewritesOf', () => {
  it('flags a page module and an open sketch variant, and skips a discarded sketch', () => {
    const target = acme();
    const page = [
      "import { definePart, drawing, html } from '@design-system';",
      "import hero from '@system/elements/hero';",
      '',
      'export default definePart({',
      "  note: 'A hero.',",
      '  states: { default: {} },',
      "  render: async () => drawing({ body: (await hero.render({ film: { title: '' } })).body.replace('<section', '<div'), styles: '' }),",
      '});',
    ].join('\n');
    const sketch = (folder: string, decision?: object) => {
      write(
        target,
        `acme/sketches/${folder}/sketch.json`,
        JSON.stringify({
          target: 'pages/home',
          status: 'in progress',
          createdAt: '2026-11-03T00:00:00.000Z',
          ...(decision ? { decision } : {}),
        }),
      );
      write(
        target,
        `acme/sketches/${folder}/b/pages/home/bare.ts`,
        BARE_COMMENT_DRAFT.replace('components/comment-draft', 'elements/hero'),
      );
    };

    write(target, 'acme/pages/home/home.ts', page);
    sketch('pages-home');
    sketch('pages-home.old', { kind: 'discard', at: '2026-11-03T00:00:00.000Z', by: 'tom' });

    expect(
      partRewritesOf(productOf(target)).map(
        (problem) => `${problem.rule} ${problem.file.split('/acme/')[1]}: ${problem.message}`,
      ),
    ).toEqual([
      "PART-REWRITE pages/home/home.ts: line 7: replace('<section') rewrites the markup of elements/hero - give elements/hero an option for this look and pass it",
      'PART-REWRITE sketches/pages-home/b/pages/home/bare.ts: line 8: replace(CARD) rewrites the markup of elements/hero - give elements/hero an option for this look and pass it',
    ]);
  });
});
