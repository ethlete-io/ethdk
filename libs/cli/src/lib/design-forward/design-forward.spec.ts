import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { designRouteOf, forwardDesign, studioDesignEntries } from './design-forward';

const only =
  (...paths: string[]) =>
  (path: string) =>
    paths.includes(path);

describe('studioDesignEntries', () => {
  it('looks in the Tauri resource folder of each platform', () => {
    expect(studioDesignEntries({ platform: 'linux', env: {}, home: '/home/u' })).toEqual([
      '/usr/lib/Ethlete Studio/cli-runtime/src/bin.js',
    ]);
    expect(studioDesignEntries({ platform: 'darwin', env: {}, home: '/Users/u' })).toEqual([
      '/Applications/Ethlete Studio.app/Contents/Resources/cli-runtime/src/bin.js',
      '/Users/u/Applications/Ethlete Studio.app/Contents/Resources/cli-runtime/src/bin.js',
    ]);
    expect(
      studioDesignEntries({
        platform: 'win32',
        env: { LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local', ProgramFiles: 'C:\\Program Files' },
        home: 'C:\\Users\\u',
      }),
    ).toEqual([
      'C:\\Users\\u\\AppData\\Local\\Ethlete Studio\\cli-runtime\\src\\bin.js',
      'C:\\Program Files\\Ethlete Studio\\cli-runtime\\src\\bin.js',
    ]);
  });

  it('takes only the named entry when ETHLETE_STUDIO_DESIGN is set', () => {
    expect(
      studioDesignEntries({ platform: 'linux', env: { ETHLETE_STUDIO_DESIGN: '/opt/studio/bin.js' }, home: '/h' }),
    ).toEqual(['/opt/studio/bin.js']);
  });
});

describe('designRouteOf', () => {
  const installed = '/home/app/node_modules/@ethlete/cli';
  const studio = '/usr/lib/Ethlete Studio/cli-runtime/src/bin.js';

  const recordedRuntime = () => {
    const home = mkdtempSync(join(tmpdir(), 'design-runtime-'));
    const data = join(home, 'data');
    const appData = join(data, 'io.ethlete.studio');
    const record = join(appData, 'design-runtime.json');
    const entry = join(home, 'portable studio', 'cli-runtime', 'src', 'bin.js');
    const options = { buildDir: installed, platform: 'linux' as const, env: { XDG_DATA_HOME: data }, home };

    mkdirSync(appData, { recursive: true });
    writeFileSync(record, JSON.stringify({ entry }));

    return { options, entry, record };
  };

  it('prefers a recorded runtime to the standard install folders', () => {
    const { options, entry } = recordedRuntime();

    mkdirSync(dirname(entry), { recursive: true });
    writeFileSync(entry, '');

    expect(designRouteOf({ ...options, exists: only(studio) })).toEqual({ kind: 'forward', entry });
  });

  it('falls back to the standard install folders when the recorded runtime is gone', () => {
    const { options, entry, record } = recordedRuntime();

    const missing = designRouteOf({ ...options, exists: only() });

    expect(missing.kind === 'missing' && missing.message).toContain(record);
    expect(missing.kind === 'missing' && missing.message).toContain(entry);
    expect(designRouteOf({ ...options, exists: only(studio) })).toEqual({ kind: 'forward', entry: studio });
  });

  it('tries the override and SDK checkout before the record and then the standard install folders', () => {
    const { options, entry } = recordedRuntime();
    const sdk = { ...options, buildDir: '/sdk/dist/libs/cli' };
    const override = '/opt/studio/bin.js';
    const exists = only('/sdk/libs/cli/src/index.ts', override, studio);

    mkdirSync(dirname(entry), { recursive: true });
    writeFileSync(entry, '');

    expect(designRouteOf({ ...sdk, exists })).toEqual({ kind: 'in-process' });
    expect(designRouteOf({ ...sdk, env: { ...sdk.env, ETHLETE_STUDIO_DESIGN: override }, exists })).toEqual({
      kind: 'forward',
      entry: override,
    });
    expect(designRouteOf({ ...options, exists })).toEqual({ kind: 'forward', entry });
  });

  it('forwards an installed cli to the installed Studio', () => {
    expect(
      designRouteOf({ buildDir: installed, platform: 'linux', env: {}, home: '/h', exists: only(studio) }),
    ).toEqual({ kind: 'forward', entry: studio });
  });

  it('names every place it looked when no Studio is installed', () => {
    const route = designRouteOf({ buildDir: installed, platform: 'linux', env: {}, home: '/h', exists: only() });

    expect(route.kind).toBe('missing');
    expect(route.kind === 'missing' && route.message).toContain(studio);
    expect(route.kind === 'missing' && route.message).toContain(
      '/h/.local/share/io.ethlete.studio/design-runtime.json',
    );
    expect(route.kind === 'missing' && route.message).toContain('ETHLETE_STUDIO_DESIGN');
  });

  it('runs the build of the SDK checkout in process, also with a Studio installed', () => {
    const exists = only('/sdk/libs/cli/src/index.ts', studio);

    expect(designRouteOf({ buildDir: '/sdk/dist/libs/cli', platform: 'linux', env: {}, home: '/h', exists })).toEqual({
      kind: 'in-process',
    });
  });

  it('forwards the SDK build too when ETHLETE_STUDIO_DESIGN names an entry', () => {
    const exists = only('/sdk/libs/cli/src/index.ts', '/x/bin.js');

    expect(
      designRouteOf({
        buildDir: '/sdk/dist/libs/cli',
        platform: 'linux',
        env: { ETHLETE_STUDIO_DESIGN: '/x/bin.js' },
        home: '/h',
        exists,
      }),
    ).toEqual({ kind: 'forward', entry: '/x/bin.js' });
  });
});

describe('forwardDesign', () => {
  it('runs the entry as `design …` in the root and hands back its exit code', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'design-forward-'));
    const entry = join(dir, 'bin.js');
    const root = join(dir, 'project');

    mkdirSync(root);
    writeFileSync(
      entry,
      "require('fs').writeFileSync('seen.json', JSON.stringify(process.argv.slice(2))); process.exitCode = 3;\n",
    );

    expect(await forwardDesign({ entry, argv: ['mcp', '--x'], root })).toBe(3);
    expect(JSON.parse(readFileSync(join(root, 'seen.json'), 'utf8'))).toEqual(['design', 'mcp', '--x']);
  });
});
