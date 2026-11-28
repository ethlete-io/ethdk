import { build } from 'esbuild';
import { resolve } from 'node:path';

const OUT_FILE = resolve(process.argv[2] ?? 'apps/timetrack/src-tauri/resources/timetrack-mcp.mjs');

await build({
  entryPoints: [resolve('libs/timetrack/src/lib/agent-mcp/timetrack-mcp.mts')],
  outfile: OUT_FILE,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  logLevel: 'warning',
});

console.log(OUT_FILE);
