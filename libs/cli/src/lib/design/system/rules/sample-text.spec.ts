import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../design-config';
import { resolveProduct } from '../resolve-product';
import { sampleTextsOf } from './sample-text';

const part = (before: string, states: string) =>
  `import { definePart, drawing, html } from '@design-system';\n${before}\nexport default definePart({ note: 'Not sample text', states: ${states}, describe: { default: 'Not sample text' }, render: () => drawing({ body: html\`<p>Render text</p>\` }) });\n`;

const textsOf = (files: Record<string, string>, products: Record<string, object> = { 'app-a': {} }) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-sample-text-'));
  const write = (path: string, text: string) => {
    mkdirSync(dirname(join(target, DESIGN_DIR, path)), { recursive: true });
    writeFileSync(join(target, DESIGN_DIR, path), text);
  };

  write('config.json', JSON.stringify({ products }));
  Object.entries(files).forEach(([path, text]) => write(`app-a/${path}`, text));

  const product = resolveProduct({ target, name: 'app-a', config: readConfig(target)?.products?.['app-a'] ?? {} });

  return sampleTextsOf(product).map(
    ({ file, message }) => `${file.split('/app-a/')[1]} ${message.split(' is sample')[0]}`,
  );
};

describe('sampleTextsOf', () => {
  it('flags text in the states that the sample data does not hold', () => {
    expect(
      textsOf({
        'fixtures.ts': "export const ORDER = { title: 'Order 1042' };\n",
        'components/card/card.ts': part(
          'import { ORDER } from \'@system/fixtures\';\nconst reason = html`<span class="text-sm font-medium">Waiting on ADR 0331</span>`;',
          "{ default: { title: ORDER.title }, held: { title: 'Order 1042', reason }, other: { title: 'Made up order' } }",
        ),
      }),
    ).toEqual(['components/card/card.ts "Waiting on ADR 0331"', 'components/card/card.ts "Made up order"']);
  });

  it('skips class lists, lower-case keys, camelCase names and foundations', () => {
    expect(
      textsOf({
        'components/plain/plain.ts': part(
          '',
          "{ default: { tone: 'muted', action: 'zoomIn', classes: 'flex gap-2 text-sm' } }",
        ),
        'foundations/type/type.ts': part('', "{ default: { sample: 'The quick brown fox' } }"),
      }),
    ).toEqual([]);
  });

  it('flags every text when the product has no sample data', () => {
    expect(textsOf({ 'pages/home/home.ts': part('', "{ default: { heading: 'Welcome back' } }") })).toEqual([
      'pages/home/home.ts "Welcome back"',
    ]);
  });

  it('judges no library, a product another product extends as its base', () => {
    const files = { 'components/button/button.ts': part('', "{ default: { label: 'Export as PDF' } }") };

    expect(textsOf(files, { 'app-a': {}, 'app-b': { base: `${DESIGN_DIR}/app-a` } })).toEqual([]);
    expect(textsOf(files)).toEqual(['components/button/button.ts "Export as PDF"']);
  });
});
