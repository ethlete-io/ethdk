import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, DesignProduct, readConfig } from '../../design-config';
import { resolveProduct } from '../resolve-product';
import { ownPartsInFramesOf } from './own-part-in-frame';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });

  return target;
};

const write = (target: string, path: string, content: string) => {
  mkdirSync(dirname(join(target, DESIGN_DIR, path)), { recursive: true });
  writeFileSync(join(target, DESIGN_DIR, path), content);
};

const part = (body = '') => `import { definePart } from '@design-system';
${body}
export default definePart({ note: '', states: {}, render: () => ({ body: '', styles: '' }) });
`;

const CANVAS = { part: 'components/viewport', zoom: 'components/zoom' };

const rulesOf = (target: string, extra: Partial<DesignProduct> = { canvas: CANVAS }) =>
  ownPartsInFramesOf(
    resolveProduct({
      target,
      name: 'acme',
      config: { ...(readConfig(target)?.products?.['acme'] ?? {}), ...extra },
    }),
  ).map((problem) => `${problem.rule} ${problem.file.split(`${DESIGN_DIR}/`)[1]} ${problem.at}`);

const withCanvas = () => {
  const target = acme();

  write(target, 'acme/components/viewport/viewport.ts', part());
  write(target, 'acme/components/zoom/zoom.ts', part());
  write(target, 'acme/components/title-bar/title-bar.ts', part());

  return target;
};

const SKETCH_ROWS = `import titleBar from '@system/components/title-bar';
export const shots = Object.keys(titleBar.states).map((state) => titleBar.render(titleBar.states[state]));
`;

describe('ownPartsInFramesOf', () => {
  it('flags a helper of a canvas page that draws an own part in its states as frame content', () => {
    const target = withCanvas();

    write(
      target,
      'acme/pages/sketches/sketches.ts',
      part(`import { shots } from './shared/sketch-rows';\nimport '@system/components/viewport';`),
    );
    write(target, 'acme/pages/sketches/shared/sketch-rows.ts', SKETCH_ROWS);

    expect(rulesOf(target)).toEqual([
      'OWN-PART-IN-FRAME acme/pages/sketches/shared/sketch-rows.ts components/title-bar:2',
    ]);
  });

  it('flags a state picked by a computed key', () => {
    const target = withCanvas();

    write(
      target,
      'acme/pages/system/system.ts',
      part(
        `import titleBar from '@system/components/title-bar';\nimport '@system/components/viewport';\nexport const drawState = (state: string) => titleBar.render(titleBar.states[state]);`,
      ),
    );

    expect(rulesOf(target)).toEqual(['OWN-PART-IN-FRAME acme/pages/system/system.ts components/title-bar:4']);
  });

  it('passes a canvas page that draws an own part as chrome, by props or one named state', () => {
    const target = withCanvas();

    write(
      target,
      'acme/pages/sketches/sketches.ts',
      part(
        `import zoom from '@system/components/zoom';\nimport titleBar from '@system/components/title-bar';\nimport '@system/components/viewport';\nzoom.render({ percent: 100 });\ntitleBar.render(titleBar.states['linux-close']);\ntitleBar.render(titleBar.states.macos);\ntype State = keyof typeof titleBar.states;`,
      ),
    );

    expect(rulesOf(target)).toEqual([]);
  });

  it('passes a page off the canvas that shows an own part in one of its states', () => {
    const target = withCanvas();

    write(target, 'acme/pages/start/start.ts', part(SKETCH_ROWS));

    expect(rulesOf(target)).toEqual([]);
  });

  it('is off without a canvas in the product config', () => {
    const target = withCanvas();

    write(target, 'acme/pages/sketches/sketches.ts', part(`import '@system/components/viewport';\n${SKETCH_ROWS}`));

    expect(rulesOf(target, {})).toEqual([]);
  });
});
