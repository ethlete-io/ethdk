import { describe, expect, it } from 'vitest';
import { discoveryPathOf } from './discovery-path';

const HOME = '/home/tom';

describe('discoveryPathOf', () => {
  it('looks where Tauri puts an application data directory on macOS', () => {
    expect(discoveryPathOf({ platform: 'darwin', home: '/Users/tom', env: {} })).toBe(
      '/Users/tom/Library/Application Support/io.ethlete.timetrack/ingest.json',
    );
  });

  it('follows XDG_DATA_HOME on Linux, and falls back to the default when it is unset', () => {
    expect(discoveryPathOf({ platform: 'linux', home: HOME, env: { XDG_DATA_HOME: '/data' } })).toBe(
      '/data/io.ethlete.timetrack/ingest.json',
    );
    expect(discoveryPathOf({ platform: 'linux', home: HOME, env: {} })).toBe(
      '/home/tom/.local/share/io.ethlete.timetrack/ingest.json',
    );
  });

  it('ignores an XDG_DATA_HOME that is set to nothing', () => {
    expect(discoveryPathOf({ platform: 'linux', home: HOME, env: { XDG_DATA_HOME: '' } })).toBe(
      '/home/tom/.local/share/io.ethlete.timetrack/ingest.json',
    );
  });

  it('follows APPDATA on Windows', () => {
    expect(
      discoveryPathOf({ platform: 'win32', home: 'C:/Users/tom', env: { APPDATA: 'C:/Users/tom/AppData/Roaming' } }),
    ).toBe('C:/Users/tom/AppData/Roaming/io.ethlete.timetrack/ingest.json');
  });
});
