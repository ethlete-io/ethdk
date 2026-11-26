import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { gunzipSync, gzipSync } from 'zlib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readApiState } from './api-state';
import {
  ComposeInvocation,
  listSnapshots,
  pipeFromGzipFile,
  pipeToGzipFile,
  restoreSnapshot,
  saveSnapshot,
  snapshotFilePath,
} from './snapshot';

const temporary = () => mkdtempSync(join(tmpdir(), 'cli-api-snapshot-'));

const snapshot = { service: 'database', databases: ['app', 'audit log'], save: 'dump', restore: 'load' };

/** A fake compose binary: it runs the sh -c script of `exec -T <service> sh -c <script>` locally, with `dump` and `load` defined. */
const fakeCompose = (options: { dump?: string; load?: string } = {}): ComposeInvocation => {
  const directory = temporary();
  const binary = join(directory, 'compose');
  const { dump = 'printf "row1\\nrow2\\n"', load = 'cat > "$OUT"' } = options;

  writeFileSync(binary, `#!/bin/sh\nshift 4\nexec sh -c 'dump() { eval "$DUMP"; }; load() { eval "$LOAD"; }; '"$2"\n`);
  chmodSync(binary, 0o755);

  return {
    binary,
    prefix: [],
    cwd: directory,
    env: { ...process.env, DUMP: dump, LOAD: load, OUT: join(directory, 'out.sql') },
  };
};

describe('pipeToGzipFile', () => {
  it('gzips what the producer writes and renames the file into place on exit 0', async () => {
    const file = join(temporary(), 'nested', 'a.sql.gz');

    expect(await pipeToGzipFile({ command: 'sh', args: ['-c', 'printf "hello\\nworld\\n"'], file })).toBe(0);
    expect(gunzipSync(readFileSync(file)).toString()).toBe('hello\nworld\n');
    expect(readdirSync(join(file, '..'))).toEqual(['a.sql.gz']);
  });

  it('writes nothing and keeps no temp file when the producer fails', async () => {
    const directory = temporary();
    const file = join(directory, 'a.sql.gz');
    const code = await pipeToGzipFile({ command: 'sh', args: ['-c', 'printf partial; exit 3'], file });

    expect(code).toBe(3);
    expect(readdirSync(directory)).toEqual([]);
  });

  it('does not replace an existing file when the producer fails', async () => {
    const directory = temporary();
    const file = join(directory, 'a.sql.gz');

    writeFileSync(file, gzipSync('old'));
    await pipeToGzipFile({ command: 'sh', args: ['-c', 'exit 1'], file });

    expect(gunzipSync(readFileSync(file)).toString()).toBe('old');
  });

  it('survives a large stream byte for byte', async () => {
    const file = join(temporary(), 'big.sql.gz');

    expect(
      await pipeToGzipFile({
        command: 'sh',
        args: ['-c', 'i=0; while [ $i -lt 20000 ]; do echo line$i; i=$((i+1)); done'],
        file,
      }),
    ).toBe(0);
    expect(gunzipSync(readFileSync(file)).toString().split('\n').length).toBe(20001);
  });

  it('reports a missing binary as 127', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const file = join(temporary(), 'a.sql.gz');

    expect(await pipeToGzipFile({ command: 'definitely-not-a-binary', args: [], file })).toBe(127);
    expect(existsSync(file)).toBe(false);
    error.mockRestore();
  });
});

describe('pipeFromGzipFile', () => {
  it('feeds the gunzipped file to the consumer', async () => {
    const directory = temporary();
    const file = join(directory, 'a.sql.gz');
    const out = join(directory, 'out.sql');

    writeFileSync(file, gzipSync('hello\nworld\n'));

    expect(await pipeFromGzipFile({ command: 'sh', args: ['-c', `cat > ${out}`], file })).toBe(0);
    expect(readFileSync(out, 'utf8')).toBe('hello\nworld\n');
  });

  it('returns the consumer’s exit code', async () => {
    const directory = temporary();
    const file = join(directory, 'a.sql.gz');

    writeFileSync(file, gzipSync('x'));

    expect(await pipeFromGzipFile({ command: 'sh', args: ['-c', 'cat > /dev/null; exit 4'], file })).toBe(4);
  });

  it('fails when the file is not gzip', async () => {
    const directory = temporary();
    const file = join(directory, 'a.sql.gz');

    writeFileSync(file, 'not gzip');

    expect(await pipeFromGzipFile({ command: 'sh', args: ['-c', 'cat > /dev/null'], file })).toBe(1);
  });
});

describe('saveSnapshot and restoreSnapshot', () => {
  let errors: string[];

  beforeEach(() => {
    errors = [];
    vi.spyOn(console, 'error').mockImplementation((message: string) => void errors.push(message));
  });

  afterEach(() => vi.restoreAllMocks());

  it('round-trips through the compose exec line with DATABASES set', async () => {
    const file = join(temporary(), 'a.sql.gz');
    const save = fakeCompose({ dump: 'echo "$DATABASES"' });

    expect(await saveSnapshot({ file, snapshot, compose: save })).toBe(0);
    expect(gunzipSync(readFileSync(file)).toString()).toBe('app audit log\n');

    const restore = fakeCompose({ load: 'cat > "$OUT"; echo "$DATABASES" >> "$OUT"' });

    expect(await restoreSnapshot({ file, snapshot, compose: restore })).toBe(0);
    expect(readFileSync(restore.env['OUT'] as string, 'utf8')).toBe('app audit log\napp audit log\n');
  });

  it('leaves no file when save fails', async () => {
    const directory = temporary();
    const file = join(directory, 'a.sql.gz');

    expect(await saveSnapshot({ file, snapshot, compose: fakeCompose({ dump: 'echo partial; exit 2' }) })).toBe(2);
    expect(readdirSync(directory)).toEqual([]);
    expect(errors[0]).toContain('exit code 2');
  });

  it('lists the files that exist when the snapshot is missing', async () => {
    const root = temporary();
    const fingerprint = 'aaaaaaaaaaaa';
    const other = snapshotFilePath({ root, api: 'hub', name: 'base', fingerprint: 'bbbbbbbbbbbb' });

    mkdirSync(join(other, '..'), { recursive: true });
    writeFileSync(other, gzipSync('x'));

    const file = snapshotFilePath({ root, api: 'hub', name: 'base', fingerprint });

    expect(await restoreSnapshot({ file, snapshot, compose: fakeCompose() })).toBe(1);
    expect(errors[0]).toContain('base-bbbbbbbbbbbb.sql.gz');
    expect(listSnapshots({ root, api: 'hub' })).toEqual(['base-bbbbbbbbbbbb.sql.gz']);
    expect(listSnapshots({ root, api: 'hub', fingerprint })).toEqual([]);
  });

  it('says so when no snapshot exists at all', async () => {
    const file = snapshotFilePath({ root: temporary(), api: 'hub', name: 'base', fingerprint: 'aaaaaaaaaaaa' });

    expect(await restoreSnapshot({ file, snapshot, compose: fakeCompose() })).toBe(1);
    expect(errors[0]).toContain('none exist');
  });

  it('records the state as clean on success and dirty on failure', async () => {
    const directory = temporary();
    const file = join(temporary(), 'a.sql.gz');
    const state = { directory, profile: 'e2e', fingerprint: 'abc123abc123' };

    writeFileSync(file, gzipSync('x'));

    expect(await restoreSnapshot({ file, snapshot, compose: fakeCompose(), state })).toBe(0);
    expect(readApiState(directory)).toMatchObject({ profile: 'e2e', fingerprint: 'abc123abc123', dirty: false });

    expect(
      await restoreSnapshot({ file, snapshot, compose: fakeCompose({ load: 'cat > /dev/null; exit 5' }), state }),
    ).toBe(5);
    expect(readApiState(directory)).toMatchObject({ profile: 'e2e', fingerprint: 'abc123abc123', dirty: true });
  });
});
