import { mkdtempSync, utimesSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { sdkDeclarationsIn } from './sdk-attribute-value';

const declarationOf = (shapes: string) => `
declare const WINDOW_CONTROL_BUTTON_SHAPES: { ${shapes} };
type WindowControlButtonShape = (typeof WINDOW_CONTROL_BUTTON_SHAPES)[keyof typeof WINDOW_CONTROL_BUTTON_SHAPES];
declare class WindowControlButtonComponent {
    shape: _angular_core.InputSignal<WindowControlButtonShape>;
    static ɵcmp: _angular_core.ɵɵComponentDeclaration<WindowControlButtonComponent, "[et-window-control-button]", never, { "shape": { "alias": "shape"; "required": false; "isSignal": true; }; }, {}, never, ["*"], true, never>;
}
`;

const shapesIn = (file: string) => [...(sdkDeclarationsIn(file).get('et-window-control-button')?.get('shape') ?? [])];

describe('sdkDeclarationsIn', () => {
  it('answers fresh after the declaration file changes, also when its mtime stays', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'cli-sdk-declarations-')), 'index.d.ts');

    writeFileSync(file, declarationOf('readonly SQUARE: "square";'));
    utimesSync(file, 1_000, 1_000);

    expect(shapesIn(file)).toEqual(['square']);

    writeFileSync(file, declarationOf('readonly SQUARE: "square"; readonly ROUND: "round";'));
    utimesSync(file, 1_000, 1_000);

    expect(shapesIn(file)).toEqual(['square', 'round']);
  });

  it('keeps the answer while the declaration file does not change', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'cli-sdk-declarations-')), 'index.d.ts');

    writeFileSync(file, declarationOf('readonly SQUARE: "square";'));

    expect(sdkDeclarationsIn(file)).toBe(sdkDeclarationsIn(file));
  });
});
