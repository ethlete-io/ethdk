import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMainThread } from 'node:worker_threads';

/**
 * Preloaded with `--import` into a design process by `design-server-proof.mjs --only P6`: writes the main-thread blocks
 * over 100 ms as `{ at, ms }` (`at` is the end of the block) to `<DESIGN_PROOF_PROBE_DIR>/<pid>.json`.
 */
const dir = process.env.DESIGN_PROOF_PROBE_DIR;
const TICK_MS = 20;

if (dir && isMainThread) {
  const blocks = [];
  let last = Date.now();

  setInterval(() => {
    const now = Date.now();
    const ms = now - last - TICK_MS;

    if (ms > 100) blocks.push({ at: now, ms });
    last = now;
  }, TICK_MS).unref();
  setInterval(() => writeFileSync(join(dir, `${process.pid}.json`), JSON.stringify(blocks)), 500).unref();
}
