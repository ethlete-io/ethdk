import { describe, expect, it } from 'vitest';
import { discoveryPathOf } from './discovery-path';

const HOME = '/home/human';

describe('discoveryPathOf', () => {
  it('looks where Tauri puts an application data directory on macOS', () => {
    expect(discoveryPathOf({ platform: 'darwin', home: '/Users/human', env: {} })).toBe(
      '/Users/human/Library/Application Support/io.ethlete.timetrack/ingest.json',
    );
  });

  it('follows XDG_DATA_HOME on Linux, and falls back to the default when it is unset', () => {
    expect(discoveryPathOf({ platform: 'linux', home: HOME, env: { XDG_DATA_HOME: '/data' } })).toBe(
      '/data/io.ethlete.timetrack/ingest.json',
    );
    expect(discoveryPathOf({ platform: 'linux', home: HOME, env: {} })).toBe(
      '/home/human/.local/share/io.ethlete.timetrack/ingest.json',
    );
  });

  it('ignores an XDG_DATA_HOME that is set to nothing', () => {
    expect(discoveryPathOf({ platform: 'linux', home: HOME, env: { XDG_DATA_HOME: '' } })).toBe(
      '/home/human/.local/share/io.ethlete.timetrack/ingest.json',
    );
  });

  it('follows APPDATA on Windows', () => {
    expect(
      discoveryPathOf({
        platform: 'win32',
        home: 'C:/Users/human',
        env: { APPDATA: 'C:/Users/human/AppData/Roaming' },
      }),
    ).toBe('C:/Users/human/AppData/Roaming/io.ethlete.timetrack/ingest.json');
  });
});
