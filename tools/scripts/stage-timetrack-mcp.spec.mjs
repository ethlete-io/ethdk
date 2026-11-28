import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

test('the staged Timetrack MCP bundle answers initialize with no node_modules around it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'timetrack-mcp-'));
  const file = join(dir, 'timetrack-mcp.mjs');

  try {
    const built = spawnSync(process.execPath, ['tools/scripts/stage-timetrack-mcp.mjs', file], { encoding: 'utf8' });
    assert.equal(built.status, 0, built.stderr);

    const child = spawn(process.execPath, [file], { cwd: dir, stdio: ['pipe', 'pipe', 'inherit'] });
    const reply = new Promise((resolve, reject) => {
      let out = '';
      child.stdout.on('data', (chunk) => {
        out += chunk;
        if (out.includes('\n')) resolve(JSON.parse(out.split('\n')[0]));
      });
      child.on('error', reject);
      child.on('exit', () => reject(new Error(`exited before answering: ${out}`)));
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })}\n`);

    const answer = await reply;
    child.kill();

    assert.equal(answer.result.protocolVersion, '2025-06-18');
    assert.equal(answer.result.serverInfo.name, 'timetrack-mcp');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
