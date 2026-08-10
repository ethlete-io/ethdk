import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Tree, addProjectConfiguration, readProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { MockInstance } from 'vitest';
import generator from './generator';

describe('devtools-about generator', () => {
  let tree: Tree;
  let consoleWarnSpy: MockInstance;

  const addApp = () =>
    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      sourceRoot: 'apps/my-app/src',
      targets: { build: { executor: '@angular/build:application' }, serve: { executor: '@angular/build:dev-server' } },
    });

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // noop
    });
  });

  afterEach(() => consoleWarnSpy.mockRestore());

  it('writes the build-info script and a placeholder for it to overwrite', async () => {
    addApp();
    await generator(tree, { project: 'my-app' });

    expect(tree.exists('tools/generate-build-info.js')).toBe(true);
    expect(tree.read('apps/my-app/src/build-info.ts', 'utf-8')).toContain('APP_BUILD_INFO');
  });

  it('runs the build-info target before both build and serve', async () => {
    addApp();
    await generator(tree, { project: 'my-app' });

    const project = readProjectConfiguration(tree, 'my-app');

    expect(project.targets?.['build-info'].executor).toBe('nx:run-commands');
    expect(project.targets?.['build'].dependsOn).toContain('build-info');
    expect(project.targets?.['serve'].dependsOn).toContain('build-info');
  });

  it('ignores the generated file - its SHA changes with every commit', async () => {
    addApp();
    await generator(tree, { project: 'my-app' });

    expect(tree.read('.gitignore', 'utf-8')).toContain('apps/my-app/src/build-info.ts');
  });

  it('passes the constant to an argument-less provideQueryDevtools()', async () => {
    addApp();
    tree.write(
      'apps/my-app/src/app/app.config.ts',
      "import { provideQueryDevtools } from '@ethlete/query';\n\nexport const config = { providers: [provideQueryDevtools()] };\n",
    );

    await generator(tree, { project: 'my-app' });

    const config = tree.read('apps/my-app/src/app/app.config.ts', 'utf-8');

    expect(config).toContain("import { APP_BUILD_INFO } from '../build-info'");
    expect(config).toContain('provideQueryDevtools({ about: APP_BUILD_INFO })');
  });

  it('leaves a call that already has options alone, and says so', async () => {
    addApp();
    tree.write(
      'apps/my-app/src/app/app.config.ts',
      'export const config = { providers: [provideQueryDevtools({ responseHistory: 10 })] };\n',
    );

    await generator(tree, { project: 'my-app' });

    expect(tree.read('apps/my-app/src/app/app.config.ts', 'utf-8')).not.toContain('APP_BUILD_INFO');
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('already passes options'));
  });

  it('warns when the app never calls provideQueryDevtools()', async () => {
    addApp();
    await generator(tree, { project: 'my-app' });

    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('No provideQueryDevtools() call found'));
  });

  it('writes a script that runs and reports the real version, SHA and branch', async () => {
    addApp();
    await generator(tree, { project: 'my-app' });

    const dir = mkdtempSync(join(tmpdir(), 'devtools-about-'));

    try {
      const script = join(dir, 'generate-build-info.js');
      const packageJson = join(dir, 'package.json');
      const output = join(dir, 'src', 'build-info.ts');

      writeFileSync(script, tree.read('tools/generate-build-info.js', 'utf-8') ?? '');
      writeFileSync(packageJson, JSON.stringify({ version: '1.4.2' }));
      execFileSync(process.execPath, [script, output, packageJson], { cwd: process.cwd() });

      const contents = readFileSync(output, 'utf-8');

      expect(contents).toContain('"version": "1.4.2"');
      expect(contents).toMatch(/"sha": "[0-9a-f]{7,}"/);
      expect(contents).toMatch(/"builtAt": "\d{4}-\d{2}-\d{2}T/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
