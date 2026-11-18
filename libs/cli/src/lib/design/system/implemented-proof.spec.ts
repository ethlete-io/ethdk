import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { implementedRefusalsOf } from './implemented-proof';

const COMPONENT = 'apps/a/src/chip/chip.component.ts';

const checkout = (files: Record<string, string>) => {
  const root = mkdtempSync(join(tmpdir(), 'cli-implemented-proof-'));

  Object.entries(files).forEach(([file, text]) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  });

  return root;
};

const componentOf = (template: string) => `import { Component, input } from '@angular/core';
import { LABELS } from '../labels';

@Component({ selector: 'a-chip', template: \`${template}\` })
export class ChipComponent {
  readonly name = input('');
  protected readonly labels = LABELS;
}
`;

const SPEC = `import { TestBed } from '@angular/core/testing';
import { ChipComponent } from './chip.component';

describe('chip', () => {
  it('shows a long name', () => {
    const fixture = TestBed.createComponent(ChipComponent);

    fixture.componentRef.setInput('name', 'A very long name that wraps');
  });
});
`;

const SAMPLE_SPEC = `import { TestBed } from '@angular/core/testing';
import type { Chip } from './chip-sample';
import { CHIP_SAMPLE } from './chip-sample';
import { ChipComponent } from './chip.component';

describe('chip', () => {
  it('shows the sample', () => {
    const fixture = TestBed.createComponent(ChipComponent);
    const chip: Chip = CHIP_SAMPLE;

    fixture.componentRef.setInput('name', chip.name);
  });
});
`;

const LABELED = '<span [title]="labels.remove">{{ labels.name }} {{ name() }}</span><i class="size-4">×</i>';

const refusalsOf = (files: Record<string, string>) =>
  implementedRefusalsOf({
    root: checkout({ 'apps/a/src/labels.ts': 'export const LABELS = {};\n', ...files }),
    component: COMPONENT,
  });

describe('implemented proof', () => {
  it('records a component whose spec renders it with its own data and whose text comes from bindings', async () => {
    expect(
      await refusalsOf({ [COMPONENT]: componentOf(LABELED), 'apps/a/src/chip/chip.component.spec.ts': SPEC }),
    ).toEqual([]);
  });

  it('refuses a component without a spec that renders it', async () => {
    expect(await refusalsOf({ [COMPONENT]: componentOf(LABELED) })).toEqual([
      `NO-SPEC ${COMPONENT}: no spec in its folder renders ChipComponent - add one that renders it with data other than the design's fixture`,
    ]);
    expect(
      await refusalsOf({
        [COMPONENT]: componentOf(LABELED),
        'apps/a/src/chip/other.spec.ts': "it('adds', () => expect(1 + 1).toBe(2));\n",
      }),
    ).toHaveLength(1);
  });

  it('refuses a spec whose every test renders the fixture data', async () => {
    const refusals = await refusalsOf({
      [COMPONENT]: componentOf(LABELED),
      'apps/a/src/chip/chip-sample.ts':
        "export type Chip = { name: string };\nexport const CHIP_SAMPLE: Chip = { name: 'a' };\n",
      'apps/a/src/chip/chip.component.spec.ts': SAMPLE_SPEC,
    });

    expect(refusals).toEqual([
      `FIXTURE-SPEC ${COMPONENT}: every test of apps/a/src/chip/chip.component.spec.ts renders fixture data (CHIP_SAMPLE) - add one with other data`,
    ]);
  });

  it('refuses user-visible literal text in the template, from text, labels and bound literals', async () => {
    const refusals = await refusalsOf({
      [COMPONENT]: componentOf(
        '<button title="Zoom in" class="px-2" [attr.aria-label]="open ? \'Close\' : labels.open">Remove {{ name() }}</button><p>{{ count === 1 ? labels.one : \'many\' }}</p><input placeholder="Search" type="text" />',
      ),
      'apps/a/src/chip/chip.component.spec.ts': SPEC,
    });

    expect(refusals).toEqual([
      `LITERAL-TEXT ${COMPONENT}: "Zoom in", "Close", "Remove", "many", "Search" - read user-visible text from the product's label map`,
    ]);
  });

  it('refuses literal text in an etTooltip, static or bound', async () => {
    const refusals = await refusalsOf({
      [COMPONENT]: componentOf(
        '<button etTooltip="Zoom to fit (Shift+1)" [attr.aria-label]="labels.fit"></button><button [etTooltip]="zoomed ? \'Reset zoom\' : labels.zoom"></button><button [etTooltip]="labels.zoom"></button>',
      ),
      'apps/a/src/chip/chip.component.spec.ts': SPEC,
    });

    expect(refusals).toEqual([
      `LITERAL-TEXT ${COMPONENT}: "Zoom to fit (Shift+1)", "Reset zoom" - read user-visible text from the product's label map`,
    ]);
  });
});
