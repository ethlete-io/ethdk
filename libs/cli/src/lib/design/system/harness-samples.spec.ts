import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { droppedStatePropsOf } from './dropped-props';
import { droppedPropsOf } from './part-compare';
import { harnessSampledPropsOf, harnessSamplesFileOf } from './harness-samples';

const SAMPLES = `
type Props = Record<string, unknown>;

export const DESIGN_HARNESS_SAMPLES: Record<string, (props: Props) => Props> = {
  'pages/sketches': ({ part, same, comparing, ...props }) => ({ ...props, part, same, comparing }),
  'pages/other': (props) => (props['kind'] === 'narrow' ? { ...props, wide: props.wide } : props),
};
`;

describe('harnessSampledPropsOf', () => {
  it('reads the props a part sample destructures or reads off its parameter', () => {
    expect(harnessSampledPropsOf({ source: SAMPLES, part: 'pages/sketches' })).toEqual(['part', 'same', 'comparing']);
    expect(harnessSampledPropsOf({ source: SAMPLES, part: 'pages/other' })).toEqual(['kind', 'wide']);
    expect(harnessSampledPropsOf({ source: SAMPLES, part: 'pages/none' })).toEqual([]);
  });

  it('accepts a prop the samples consume although no input takes it, and still refuses one neither takes', () => {
    const consumed = harnessSampledPropsOf({ source: SAMPLES, part: 'pages/sketches' });

    expect(
      droppedPropsOf({
        props: { camera: 'fit', comparing: true, stray: 1 },
        inputs: ['camera'],
        designOnly: new Set(['class', ...consumed]),
      }),
    ).toEqual(['stray']);
    expect(
      droppedStatePropsOf({
        states: { base: { camera: 'fit' }, comparing: { camera: 'fit', comparing: true, stray: 1 } },
        inputs: ['camera'],
        sampled: consumed,
      }),
    ).toEqual(new Map([['comparing', ['stray']]]));
  });
});

describe('harnessSamplesFileOf', () => {
  it('finds the file next to the harness map that exports DESIGN_HARNESS_SAMPLES', () => {
    const target = mkdtempSync(join(tmpdir(), 'et-samples-'));
    const dir = join(target, 'app/design-harness');

    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'design-harness-parts.ts'), 'export const DESIGN_HARNESS_PARTS = {};');
    writeFileSync(join(dir, 'design-harness-samples.ts'), SAMPLES);
    writeFileSync(join(dir, 'design-harness-samples.spec.ts'), `import { DESIGN_HARNESS_SAMPLES } from './x';`);

    expect(harnessSamplesFileOf({ target, map: 'app/design-harness/design-harness-parts.ts' })).toBe(
      join(dir, 'design-harness-samples.ts'),
    );
    expect(harnessSamplesFileOf({ target, map: 'missing/parts.ts' })).toBeNull();
  });
});
