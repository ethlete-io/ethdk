import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { ruleProblemsOf } from '../check-system';
import { resolveProduct } from '../resolve-product';
import { gluedInterpolationsOf } from './glued-interpolation';

const acme = (markup: string) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });

  const file = join(target, DESIGN_DIR, 'acme/pages/home/home.ts');

  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    `import { definePart } from '@design-system';\nconst props = { class: '', name: '' };\nexport default definePart({ note: '', states: {}, render: () => ({ body: \`${markup}\`, styles: '' }) });\n`,
  );

  return resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
};

const messagesOf = (markup: string) => gluedInterpolationsOf(acme(markup)).map((problem) => problem.message);

const report = (name: string) =>
  `The class \`${name}\` is glued to a \`\${...}\` interpolation - Tailwind reads both as one candidate and emits no CSS for it; put a space between the class and the interpolation`;

describe('gluedInterpolationsOf', { timeout: 30_000 }, () => {
  it('reports a class glued before an interpolation', () => {
    expect(
      messagesOf(
        `<div class="flex shadow-(--x,0_10px_24px_rgb(0_0_0/0.16))\${props.class ? ' ' + props.class : ''}"></div>`,
      ),
    ).toEqual([report('shadow-(--x,0_10px_24px_rgb(0_0_0/0.16))')]);
  });

  it('reports a class glued after an interpolation', () => {
    expect(messagesOf(`<div class="flex \${props.class}p-2"></div>`)).toEqual([report('p-2')]);
  });

  it('passes a space around the interpolation', () => {
    expect(messagesOf(`<div class="flex shadow-lg \${props.class} p-2"></div>`)).toEqual([]);
  });

  it('passes a class name built by interpolation', () => {
    expect(
      messagesOf(
        `<span class="et-icon--\${props.name} md:\${props.name} w-1/\${props.name} \${props.name}-x \${props.name}\${props.name}"></span>`,
      ),
    ).toEqual([]);
  });

  it('runs as part of design check', () => {
    const product = acme(`<div class="flex\${props.class}"></div>`);

    expect(ruleProblemsOf(product).filter((problem) => problem.rule === 'CLASS-GLUED-INTERPOLATION')).toHaveLength(1);
  });
});
