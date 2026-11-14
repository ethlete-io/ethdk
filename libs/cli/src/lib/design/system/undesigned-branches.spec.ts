import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inputInitialsOf } from './dropped-props';
import { angularCompilerOf, componentTemplateOf, undesignedBranchesOf } from './undesigned-branches';

const titleBar = (template: string) => `
import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-title-bar',
  template: \`${template}\`,
})
export class TitleBarComponent {
  notice = input(false);
  noticeText = input<string>();
  restart = input<'pending' | 'failed' | null>(null);
  update = input(false);
  os = input.required<string>();
  canvas = input<TemplateRef<unknown> | null>(null);
  caption = computed(() => this.os() === 'windows');
}
`;

const NOTICE = `
  @if (!notice() && noticeText(); as text) {
    <span data-code-notice>{{ text }}</span>
  }
  @if (notice()) {
    <button [etTooltip]="restart() ? null : noticeText()">Neu starten</button>
  }
  @if (restart() === 'failed') {
    <app-error-toast />
  }
  @if (update()) {
    <button>Update</button>
  }
`;

describe('undesignedBranchesOf', () => {
  let compiler: NonNullable<Awaited<ReturnType<typeof angularCompilerOf>>>;

  beforeAll(async () => {
    const loaded = await angularCompilerOf();

    if (!loaded) throw new Error('@angular/compiler is not installed');
    compiler = loaded;
  });

  const of = (template: string, states: Record<string, unknown>) =>
    undesignedBranchesOf({ compiler, template, inputs: inputInitialsOf(titleBar(template)), states });

  it('names the CLI-dirty notice no design state draws (finding 484)', () => {
    expect(
      of(NOTICE, {
        rest: { os: 'linux' },
        notice: { os: 'linux', update: true, notice: true, noticeText: 'CLI geändert - neu starten' },
        'notice-failed': { os: 'linux', notice: true, noticeText: 'x', restart: 'failed' },
      }),
    ).toEqual(['@if (!notice() && noticeText())']);
  });

  it('labels an else-if branch with the head of its chain', () => {
    const template = `@if (notice()) { <b>a</b> } @else if (update()) { <b>b</b> }`;

    expect(of(template, { rest: { os: 'linux', notice: true, update: true } })).toEqual([
      '@if (notice()) @else if (update())',
    ]);
  });

  it('passes once a state draws the notice text without the restart button', () => {
    expect(
      of(NOTICE, {
        rest: { os: 'linux' },
        notice: { os: 'linux', update: true, notice: true, noticeText: 'CLI geändert - neu starten' },
        'notice-failed': { os: 'linux', notice: true, noticeText: 'x', restart: 'failed' },
        'cli-dirty': { os: 'linux', noticeText: 'CLI hat uncommittete Änderungen' },
      }),
    ).toEqual([]);
  });

  it('reads an input no state sets at its literal default', () => {
    expect(of(NOTICE, { rest: { os: 'linux', notice: true, noticeText: 'x' } })).toEqual([
      '@if (!notice() && noticeText())',
      "@if (restart() === 'failed')",
      '@if (update())',
    ]);
  });

  it('names an else branch and a nested branch only reachable through an undesigned one', () => {
    const template = `
      @if (notice()) {
        <button>Neu starten</button>
      } @else {
        @if (update()) { <button>Update</button> }
      }
    `;

    expect(of(template, { rest: { os: 'linux', notice: true, update: true } })).toEqual([
      '@if (notice()) @else',
      '@if (update())',
    ]);
  });

  it('counts a branch on a computed, a loop variable, a required or a template input as taken', () => {
    const template = `
      @if (canvas()) { <ng-container *ngTemplateOutlet="canvas()" /> }
      @if (caption()) { <span>caption</span> }
      @if (os() === 'macos') { <span>reserve</span> }
      @for (button of buttons(); track button) {
        @if (button === 'close') { <span>close</span> }
      }
    `;

    expect(of(template, { rest: { notice: false } })).toEqual([]);
  });
});

describe('componentTemplateOf', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'undesigned-'));
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('reads an inline template and a templateUrl file', () => {
    writeFileSync(join(dir, 'inline.component.ts'), titleBar('<b>inline</b>'));
    writeFileSync(join(dir, 'url.component.html'), '<b>url</b>');
    writeFileSync(
      join(dir, 'url.component.ts'),
      `@Component({ selector: 'x', templateUrl: './url.component.html' }) export class X {}`,
    );

    expect(componentTemplateOf(join(dir, 'inline.component.ts'))).toBe('<b>inline</b>');
    expect(componentTemplateOf(join(dir, 'url.component.ts'))).toBe('<b>url</b>');
  });
});
