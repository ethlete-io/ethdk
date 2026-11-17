import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, DesignProduct, readConfig } from '../../design-config';
import { resolveProduct } from '../resolve-product';
import { ownCanvasesOf } from './own-canvas';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });

  return target;
};

const write = (target: string, path: string, content: string) => {
  mkdirSync(dirname(join(target, DESIGN_DIR, path)), { recursive: true });
  writeFileSync(join(target, DESIGN_DIR, path), content);
};

const partImporting = (...specifiers: string[]) => `import { definePart } from '@design-system';
${specifiers.map((specifier, index) => `import p${index} from '${specifier}';`).join('\n')}
export default definePart({ note: '', states: {}, render: () => ({ body: '', styles: '' }) });
`;

const CANVAS = { part: 'components/viewport', zoom: 'components/zoom' };

const rulesOf = (target: string, extra: Partial<DesignProduct> = { canvas: CANVAS }) =>
  ownCanvasesOf(
    resolveProduct({
      target,
      name: 'acme',
      config: { ...(readConfig(target)?.products?.['acme'] ?? {}), ...extra },
    }),
  ).map((problem) => `${problem.rule} ${problem.file.split(`${DESIGN_DIR}/`)[1]}`);

const withCanvasParts = () => {
  const target = acme();

  write(target, 'acme/components/viewport/viewport.ts', partImporting());
  write(target, 'acme/components/zoom/zoom.ts', partImporting());

  return target;
};

describe('ownCanvasesOf', () => {
  it('flags a part that draws the zoom control without the canvas part', () => {
    const target = withCanvasParts();

    write(target, 'acme/pages/flows/flows.ts', partImporting('@system/components/zoom'));

    expect(rulesOf(target)).toEqual(['OWN-CANVAS acme/pages/flows/flows.ts']);
  });

  it('flags the zoom control imported through a module of the part folder', () => {
    const target = withCanvasParts();

    write(target, 'acme/pages/flows/flows.ts', partImporting('./shared/chip'));
    write(target, 'acme/pages/flows/shared/chip.ts', `import zoom from '@system/components/zoom';\nexport { zoom };\n`);

    expect(rulesOf(target)).toEqual(['OWN-CANVAS acme/pages/flows/flows.ts']);
  });

  it('passes a part that reaches the canvas part directly or through another part', () => {
    const target = withCanvasParts();

    write(
      target,
      'acme/elements/frames/frames.ts',
      partImporting('@system/components/zoom', '@system/components/viewport'),
    );
    write(target, 'acme/pages/flows/flows.ts', partImporting('@system/components/zoom', '@system/components/viewport'));
    write(target, 'acme/pages/inbox/inbox.ts', partImporting('@system/elements/frames'));

    expect(rulesOf(target)).toEqual([]);
  });

  it('is off without a canvas in the product config', () => {
    const target = withCanvasParts();

    write(target, 'acme/pages/flows/flows.ts', partImporting('@system/components/zoom'));

    expect(rulesOf(target, {})).toEqual([]);
  });
});
