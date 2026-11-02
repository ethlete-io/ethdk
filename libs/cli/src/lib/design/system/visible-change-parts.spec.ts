import { describe, expect, it } from 'vitest';
import { appPartsOf } from './visible-change-parts';

const files: Record<string, string> = {
  '/app/pin/pin.component.ts': `import { label } from '../shared/label';\nimport { Button } from '@ethlete/components';`,
  '/app/pin/pin.component.html': '<button></button>',
  '/app/shared/label.ts': `export const label = 'x';`,
  '/app/chip/chip.component.ts': `import { ChipIcon } from './icon';`,
  '/app/chip/icon/index.ts': 'export class ChipIcon {}',
  '/app/page/page.component.ts': `import { PinComponent } from '../pin/pin.component';`,
};
const entries = [
  { part: 'components/pin', file: '/app/pin/pin.component.ts' },
  { part: 'components/chip', file: '/app/chip/chip.component.ts' },
  { part: 'pages/page', file: '/app/page/page.component.ts' },
];
const partsOf = (changed: string[]) =>
  appPartsOf({
    entries,
    changed,
    everyPart: (file) => file.startsWith('/libs/'),
    read: (file) => files[file] ?? null,
  });

describe('appPartsOf', () => {
  it('finds each part whose component reaches a changed source file through relative imports', () => {
    expect(partsOf(['/app/shared/label.ts'])).toEqual(new Set(['components/pin', 'pages/page']));
    expect(partsOf(['/app/chip/icon/index.ts'])).toEqual(new Set(['components/chip']));
  });

  it('counts a changed template for each part that reaches a source file in its folder', () => {
    expect(partsOf(['/app/pin/pin.component.html'])).toEqual(new Set(['components/pin', 'pages/page']));
  });

  it('finds no part for an app file no part reaches', () => {
    expect(partsOf(['/app/studio-view/view.component.ts', '/app/other/other.css'])).toEqual(new Set());
  });

  it('gives every part for a change every part draws with', () => {
    expect(partsOf(['/app/shared/label.ts', '/libs/components/button.css'])).toBe('all');
  });
});
