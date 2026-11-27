import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { closeSync, constants, mkdtempSync, openSync, readSync, rmSync, statSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';

const runner = join(import.meta.dirname, 'canvas.e2e.mjs');
const PAGE = 4096;

const fillPipe = (fd) => {
  for (;;) {
    try {
      writeSync(fd, Buffer.alloc(PAGE));
    } catch (error) {
      if (error.code === 'EAGAIN') return;
      throw error;
    }
  }
};

const readAll = async (fd) => {
  const buffer = Buffer.alloc(65536);
  const chunks = [];

  for (;;) {
    try {
      const bytes = readSync(fd, buffer);

      if (!bytes) return Buffer.concat(chunks).toString('utf8');
      chunks.push(Buffer.from(buffer.subarray(0, bytes)));
    } catch (error) {
      if (error.code !== 'EAGAIN') throw error;
      await sleep(10);
    }
  }
};

test('--list prints every row into a pipe with one free page and a reader that waits', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'studio-e2e-list-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const fifo = join(dir, 'stdout');

  execFileSync('mkfifo', [fifo]);
  const readFd = openSync(fifo, constants.O_RDONLY | constants.O_NONBLOCK);
  const writeFd = openSync(fifo, constants.O_WRONLY | constants.O_NONBLOCK);
  t.after(() => closeSync(readFd));

  fillPipe(writeFd);
  readSync(readFd, Buffer.alloc(PAGE));
  const filledAt = statSync(fifo).mtimeMs;

  const child = spawn(process.execPath, [runner, '--list'], { stdio: ['ignore', writeFd, 'inherit'] });
  const exit = new Promise((resolve) => child.on('exit', resolve));
  let exited = false;

  closeSync(writeFd);
  void exit.then(() => (exited = true));
  while (!exited && statSync(fifo).mtimeMs === filledAt) await sleep(20);
  await Promise.race([exit, sleep(1000)]);

  const rows = (await readAll(readFd)).replaceAll('\0', '').trim().split('\n');
  const cases = Number(rows[0].match(/^(\d+) of/u)?.[1]);

  assert.equal(await exit, 0);
  assert.ok(cases > 0, rows[0]);
  assert.equal(rows.length, cases + 1);
});
