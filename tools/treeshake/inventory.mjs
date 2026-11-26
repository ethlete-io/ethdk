#!/usr/bin/env node
/**
 * Inventory of the top-level declarations that block tree-shaking, grouped by what initializes them.
 *
 * esbuild keeps a top-level statement unconditionally unless it can prove the initializer is
 * side-effect free. This lists every `const X = someCall(…)` / `const [a, b] = someCall(…)` whose
 * initializer is an un-annotated call or `new`, so you can see which factory is responsible for how
 * many pinned declarations before deciding what to change.
 *
 * Run it on the LINKED FESMs (a cache dir), not on `libs/` source: the linker and the optimizer
 * passes change what the shapes look like.
 *
 * Usage:
 *   node tools/treeshake/inventory.mjs <file.mjs> [<file.mjs> …]
 *   node tools/treeshake/inventory.mjs --cache <dir>      # every FESM in a cache dir
 *
 * Example:
 *   node tools/treeshake/inventory.mjs --cache /tmp/ethlete-treeshake/linked-3b8c1f6ac1b1
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { makeArgs } from './harness.mjs';

const { argv, arg } = makeArgs();

const collect = (dir, acc = []) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) collect(p, acc);
    else if (p.endsWith('.mjs')) acc.push(p);
  }
  return acc;
};

const cache = arg('cache');
const files = cache ? collect(resolve(cache)) : argv.filter((a) => !a.startsWith('--')).map((a) => resolve(a));
if (!files.length) throw new Error('pass one or more .mjs files, or --cache <dir>');

for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  const counts = new Map();
  const examples = new Map();
  for (let i = 0; i < lines.length; i++) {
    // top-level const/let/var whose initializer starts with a call or `new`
    const m = /^(?:const|let|var)\s+(?:\[[^\]]*\]|\{[^}]*\}|[A-Za-z_$][\w$]*)\s*=\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const init = m[1];
    if (init.startsWith('/*#__PURE__*/') || init.startsWith('/* @__PURE__ */')) continue;
    const c = /^(new\s+[A-Za-z_$][\w$.]*|[A-Za-z_$][\w$.]*)\s*\(/.exec(init);
    if (!c) continue;
    counts.set(c[1], (counts.get(c[1]) ?? 0) + 1);
    if (!examples.has(c[1])) examples.set(c[1], `${i + 1}: ${lines[i].slice(0, 120)}`);
  }
  const rows = [...counts].sort((a, b) => b[1] - a[1]);
  if (!rows.length) continue;
  console.log(`\n### ${f}`);
  let total = 0;
  for (const [callee, n] of rows) {
    total += n;
    console.log(`${String(n).padStart(4)}  ${callee.padEnd(34)} ${examples.get(callee)}`);
  }
  console.log(`total impure top-level call initializers: ${total}`);
}
