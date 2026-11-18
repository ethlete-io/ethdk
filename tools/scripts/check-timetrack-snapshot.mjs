import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ROW_CHANGING_PATHS = {
  libFolder: 'libs/timetrack/src/lib/',
  libExcluded: ['jira', 'tempo', 'transport', 'google-auth', 'settings', 'ticket', 'agent-api'],
  appFolders: [
    'apps/timetrack/src/app/day-review/',
    'apps/timetrack/src/app/naming/',
    'apps/timetrack/src/app/stand-ins/',
    'apps/timetrack/src/app/sources/',
    'apps/timetrack/src/app/peers/',
  ],
  appFiles: ['apps/timetrack/src/app/read-day.ts', 'apps/timetrack/src/app/stream-day-options.ts'],
};

const FRESH_MS = 6 * 60 * 60 * 1000;

export const isRowChangingPath = (path) => {
  if (!path.endsWith('.ts') || path.endsWith('.spec.ts')) return false;
  const { libFolder, libExcluded, appFolders, appFiles } = ROW_CHANGING_PATHS;
  if (path.startsWith(libFolder)) return !libExcluded.some((folder) => path.startsWith(`${libFolder}${folder}/`));
  return appFolders.some((folder) => path.startsWith(folder)) || appFiles.includes(path);
};

export const snapshotDir = (env = process.env) => {
  const override = env['TIMETRACK_SNAPSHOT_DIR']?.trim();
  if (override) return override;
  const discovery = env['TIMETRACK_AGENT_DISCOVERY']?.trim();
  if (discovery) return join(dirname(discovery), 'snapshots');
  const home = homedir();
  const identifier = 'io.ethlete.timetrack';
  if (platform() === 'darwin') return join(home, 'Library', 'Application Support', identifier, 'snapshots');
  if (platform() === 'win32') {
    return join(env['APPDATA']?.trim() || join(home, 'AppData', 'Roaming'), identifier, 'snapshots');
  }
  return join(env['XDG_DATA_HOME']?.trim() || join(home, '.local', 'share'), identifier, 'snapshots');
};

export const hasFreshSnapshot = (dir, now = Date.now()) =>
  existsSync(dir) &&
  readdirSync(dir).some((name) => name.endsWith('.json') && now - statSync(join(dir, name)).mtimeMs <= FRESH_MS);

export const snapshotCheck = (message, stagedPaths, freshSnapshot) => {
  const rows = stagedPaths.filter(isRowChangingPath);
  if (rows.length === 0) return { ok: true, rows };
  const line = message.split('\n').find((l) => l.startsWith('Snapshot:'));
  if (line === undefined) return { ok: false, rows };
  const notRun = /^Snapshot:\s*not run\s*\((.*)\)\s*$/i.exec(line);
  if (notRun) return { ok: notRun[1].trim() !== '', rows };
  return { ok: freshSnapshot(), rows };
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const message = readFileSync(process.argv[2], 'utf8');
  const staged = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMDR'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  const { ok, rows } = snapshotCheck(message, staged, () => hasFreshSnapshot(snapshotDir()));
  if (!ok) {
    process.stderr.write(
      [
        'This commit touches paths that can change Timetrack rows:',
        ...rows.map((row) => `  ${row}`),
        'Add a line to the message in one of these forms:',
        '  Snapshot: <the --compare result, every changed row explained>   (needs a snapshot file from the last 6 h in ' +
          `${snapshotDir()})`,
        '  Snapshot: not run (<reason>)',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }
}
