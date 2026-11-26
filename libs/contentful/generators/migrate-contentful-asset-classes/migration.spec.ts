import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { MockInstance } from 'vitest';
import migration, { CONTENTFUL_ASSET_CLASSES_REPORT_PATH } from './migration';

describe('migrate-contentful-asset-classes', () => {
  let tree: Tree;
  let consoleLogSpy: MockInstance;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      // noop
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  const run = async (file: string, content: string) => {
    tree.write(file, content);
    await migration(tree, { skipFormat: true });

    return tree.read(file, 'utf-8');
  };

  const report = () => tree.read(CONTENTFUL_ASSET_CLASSES_REPORT_PATH, 'utf-8') ?? '';

  it('removes every dropped input from an html template and reports each with its replacement', async () => {
    const file = 'apps/web/src/app/media.component.html';
    const result = await run(
      file,
      [
        '<et-contentful-video [asset]="video" videoClass="rounded" />',
        '<et-contentful-audio',
        '  [asset]="audio"',
        `  [audioClass]="'w-full'"`,
        '  figureClass="m-0"',
        '  [figcaptionClass]="captionClass"',
        '></et-contentful-audio>',
        '<et-contentful-file [asset]="file" [fileClass]="{ bold: true }" />',
        '<et-contentful-link href="/a" text="A" textClass="mark" anchorClass="link" />',
      ].join('\n'),
    );

    expect(result).toBe(
      [
        '<et-contentful-video [asset]="video" />',
        '<et-contentful-audio',
        '  [asset]="audio"',
        '></et-contentful-audio>',
        '<et-contentful-file [asset]="file" />',
        '<et-contentful-link href="/a" text="A" />',
      ].join('\n'),
    );

    const text = report();

    expect(text).toContain(
      `- ${file}:1\n- Removed \`videoClass="rounded"\` from \`et-contentful-video\`. Style the static \`.et-contentful-video-video\` class instead.`,
    );
    expect(text).toContain(`- ${file}:4\n- Removed \`[audioClass]="'w-full'"\``);
    expect(text).toContain('`.et-contentful-audio-audio`');
    expect(text).toContain(`- ${file}:5\n- Removed \`figureClass="m-0"\``);
    expect(text).toContain('`.et-contentful-audio-figure`');
    expect(text).toContain(`- ${file}:6\n- Removed \`[figcaptionClass]="captionClass"\``);
    expect(text).toContain('`.et-contentful-audio-figcaption`');
    expect(text).toContain(`- ${file}:8\n- Removed \`[fileClass]="{ bold: true }"\``);
    expect(text).toContain('`.et-contentful-file-anchor`');
    expect(text).toContain(`- ${file}:9\n- Removed \`textClass="mark"\``);
    expect(text).toContain(`- ${file}:9\n- Removed \`anchorClass="link"\``);
    expect(text).toContain('`.et-contentful-link-anchor`');
  });

  it('migrates inline templates and reports the line in the ts file', async () => {
    const file = 'apps/web/src/app/media.component.ts';
    const result = await run(
      file,
      [
        "import { Component } from '@angular/core';",
        '',
        '@Component({',
        '  selector: "app-media",',
        '  template: `',
        `    <et-contentful-video [asset]="video" [videoClass]="'rounded'" />`,
        '  `,',
        '})',
        'export class MediaComponent {}',
      ].join('\n'),
    );

    expect(result).toContain('<et-contentful-video [asset]="video" />');
    expect(report()).toContain(`- ${file}:6\n- Removed \`[videoClass]="'rounded'"\``);
  });

  it('leaves other elements, other inputs and attribute values alone', async () => {
    const content = [
      '<et-picture figureClass="keep" />',
      '<et-contentful-video-player videoClass="keep" />',
      '<et-contentful-video [asset]="video" title="videoClass here" />',
      '<et-contentful-audio audioClassName="keep" />',
      '<et-contentful-file figureClass="keep" />',
    ].join('\n');

    expect(await run('apps/web/src/app/other.component.html', content)).toBe(content);
    expect(tree.exists(CONTENTFUL_ASSET_CLASSES_REPORT_PATH)).toBe(false);
  });

  it('reports a custom link component that still declares the dropped inputs', async () => {
    const file = 'apps/web/src/app/custom-link.component.ts';
    const content = [
      "import { Component, input } from '@angular/core';",
      '',
      "@Component({ selector: 'app-link', template: '' })",
      'export class CustomLinkComponent {',
      '  textClass = input.required<string>();',
      '}',
    ].join('\n');

    expect(await run(file, content)).toBe(content);
    expect(report()).toContain(`- ${file}:5\n- \`textClass\` is declared as an input.`);
    expect(report()).toContain('`marks`');
  });
});
