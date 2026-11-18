import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR } from '../design-config';
import { builderReasonsOf, developerPartLinesOf, partBuilderOf, takesDataOf } from './part-builder';
import { readOpenPoints } from './read-open-points';
import { partKeyOf, resolveProduct } from './resolve-product';

const PRESENTATIONAL = `import { Component, ElementRef, inject, input, output } from '@angular/core';
import { ButtonComponent, injectSemanticColorTheme } from '@ethlete/components';

@Component({ selector: 'app-chip', imports: [ButtonComponent], templateUrl: './chip.component.html' })
export class ChipComponent {
  label = input.required<string>();
  removed = output<void>();
  private host = inject(ElementRef);
  private theme = injectSemanticColorTheme('error');
}
`;

const DEVELOPER = `import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { InboxStore } from '../inbox.store';

@Component({ selector: 'app-inbox', template: '<a routerLink="/next">next</a>' })
export class InboxComponent {
  private store = inject(InboxStore);
  private router = inject(Router);
  constructor(private http: HttpClient) {}
}
`;

const checkout = (component: string, template = '<et-button>{{ label() }}</et-button>') => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-part-builder-'));
  const design = join(target, DESIGN_DIR);

  mkdirSync(join(design, 'app-a', 'components/chip'), { recursive: true });
  writeFileSync(
    join(design, 'app-a', 'components/chip/chip.ts'),
    "export default definePart({ implements: 'src/chip/chip.component.ts', states: { default: {} } });\n",
  );
  writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));
  mkdirSync(join(target, 'src/chip'), { recursive: true });
  writeFileSync(join(target, 'src/chip/chip.component.ts'), component);
  writeFileSync(join(target, 'src/chip/chip.component.html'), template);

  const product = resolveProduct({ target, name: 'app-a', config: {} });
  const part = product.parts.find((found) => partKeyOf(found) === 'components/chip');

  if (!part) throw new Error('fixture part missing');

  return { product, part, target };
};

describe('part builder (B250)', () => {
  it('keeps a part whose component takes inputs and outputs and composes SDK components a designer part', () => {
    expect(partBuilderOf(checkout(PRESENTATIONAL))).toEqual({ builder: 'designer' });
  });

  it('makes a part whose component injects a service, loads data or routes a developer part, naming each reason', () => {
    const builder = partBuilderOf(checkout(DEVELOPER));

    expect(builder).toEqual({
      builder: 'developer',
      reasons: [
        'routes: imports Router from @angular/router (src/chip/chip.component.ts)',
        'loads data: imports HttpClient from @angular/common/http (src/chip/chip.component.ts)',
        'injects the service InboxStore (src/chip/chip.component.ts)',
        'injects the service Router (src/chip/chip.component.ts)',
        'injects the service HttpClient in its constructor (src/chip/chip.component.ts)',
        'routes: uses routerLink (src/chip/chip.component.ts)',
      ],
    });
  });

  it('finds routerLink in a separate template', () => {
    expect(partBuilderOf(checkout(PRESENTATIONAL, '<a routerLink="/x">x</a>'))).toEqual({
      builder: 'developer',
      reasons: ['routes: uses routerLink (src/chip/chip.component.ts)'],
    });
  });

  it('checks the design file before the build', () => {
    expect(
      builderReasonsOf({
        source: "import { injectQuery } from '@ethlete/query';\nexport const rows = await fetch('/api/rows');\n",
      }),
    ).toEqual(['loads data: imports injectQuery from @ethlete/query', 'loads data: calls fetch()']);
  });

  it('prints one line per developer part', () => {
    expect(developerPartLinesOf({ product: checkout(DEVELOPER).product })[0]).toMatch(
      /^DEVELOPER app-a components\/chip: routes: imports Router .* - a developer builds it$/u,
    );
  });

  it('follows a plain function imported from a relative app file one level and counts what it injects (B250c)', () => {
    const component = `import { Component } from '@angular/core';
import { openPalette, formatLabel } from '../palette/open-palette';

@Component({ selector: 'app-chip', template: '' })
export class ChipComponent {
  protected open = openPalette();
  protected label = formatLabel('x');
}
`;
    const { product, part, target } = checkout(component);

    mkdirSync(join(target, 'src/palette'), { recursive: true });
    writeFileSync(
      join(target, 'src/palette/open-palette.ts'),
      `import { ElementRef, inject } from '@angular/core';
import { PaletteStore } from './palette.store';

export const openPalette = () => {
  const store = inject(PaletteStore);
  return () => store.open();
};

export function formatLabel(text: string) {
  inject(ElementRef);
  return text.toUpperCase();
}
`,
    );

    expect(partBuilderOf({ product, part })).toEqual({
      builder: 'developer',
      reasons: [
        'calls openPalette() from ../palette/open-palette, which injects the service PaletteStore (src/chip/chip.component.ts)',
      ],
    });
  });

  it('says a part takes data only when it loads data, and then asks for loading, error and empty (B251a)', () => {
    const store =
      "import { Component, inject } from '@angular/core';\nimport { Store } from '../store';\n@Component({})\nexport class C { private store = inject(Store); }\n";

    expect(takesDataOf(checkout(DEVELOPER))).toBe(true);
    expect(takesDataOf(checkout(PRESENTATIONAL))).toBe(false);
    expect(takesDataOf(checkout(store))).toBe(false);
    expect(readOpenPoints(checkout(DEVELOPER).product)).toEqual([
      {
        part: 'components/chip',
        points: [
          { kind: 'missing-state', control: null },
          { kind: 'missing-state', control: null, data: 'loading' },
          { kind: 'missing-state', control: null, data: 'error' },
          { kind: 'missing-state', control: null, data: 'empty' },
        ],
      },
    ]);
  });
});
