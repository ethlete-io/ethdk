#!/usr/bin/env node
/**
 * Retention analysis of an unminified esbuild bundle (produced by decompose.mjs --dump).
 *
 * Splits the bundle into top-level statements, builds the reference graph between them, and
 * classifies each statement as a ROOT (an initializer esbuild cannot prove side-effect-free, so
 * the statement is unconditionally kept) or as PULLED (kept only because a root reaches it).
 *
 * For every root it reports:
 *   reach      bytes of top-level statements reachable from that root (roots overlap)
 *   exclusive  bytes reachable from that root and from no other root nor the entry's own use
 *
 * `exclusive` is the number that matters: it is what disappears if that one declaration becomes
 * droppable.
 *
 * Usage: node tools/treeshake/retention.mjs <bundle.js> [--top 30] [--json out.json]
 *
 * <bundle.js> is an UNMINIFIED bundle from dump-bundle.mjs (or decompose.mjs --dump).
 *
 * Example:
 *   node tools/treeshake/retention.mjs /tmp/ethlete-treeshake/floor-unmin.js --top 25
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OUT_ROOT, assertOutsideRepo } from './harness.mjs';

const [file, ...rest] = process.argv.slice(2);
if (!file) throw new Error('usage: retention.mjs <unminified-bundle.js> [--top 30] [--json out.json]');
const arg = (n, d) => {
  const i = rest.indexOf(`--${n}`);
  return i === -1 ? d : rest[i + 1];
};
const topN = Number(arg('top', 30));

const src = readFileSync(file, 'utf8');
const lines = src.split('\n');

// --- 1. split into top-level statements -------------------------------------------------------
// esbuild's unminified output puts every top-level statement's first token at column 0 and
// indents everything nested, so a line starting with a non-space, non-closer character begins a
// new top-level statement.
const starts = [];
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (!l.length) continue;
  if (/^\s/.test(l)) continue;
  if (/^[})\]]/.test(l)) continue;
  starts.push(i);
}
const stmts = starts.map((start, idx) => {
  const end = idx + 1 < starts.length ? starts[idx + 1] : lines.length;
  const text = lines.slice(start, end).join('\n');
  return { idx, line: start + 1, endLine: end, text, bytes: Buffer.byteLength(text) + 1 };
});

// --- 2. declared names ------------------------------------------------------------------------
const declared = new Map(); // name -> stmt idx
for (const s of stmts) {
  const head = s.text.slice(0, 400);
  let m;
  if ((m = /^(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=/.exec(head))) {
    declared.set(m[1], s.idx);
    s.names = [m[1]];
  } else if ((m = /^(?:var|let|const)\s*\[([^\]]*)\]\s*=/.exec(head))) {
    s.names = m[1]
      .split(',')
      .map((x) => x.trim())
      .filter((x) => x && x !== '')
      .map((x) => x.replace(/^\.\.\./, ''));
    for (const n of s.names) declared.set(n, s.idx);
  } else if ((m = /^(?:var|let|const)\s*\{([^}]*)\}\s*=/.exec(head))) {
    s.names = m[1]
      .split(',')
      .map((x) => x.trim().split(':').pop().trim())
      .filter(Boolean);
    for (const n of s.names) declared.set(n, s.idx);
  } else if ((m = /^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/.exec(head))) {
    declared.set(m[1], s.idx);
    s.names = [m[1]];
  } else if ((m = /^class\s+([A-Za-z_$][\w$]*)/.exec(head))) {
    declared.set(m[1], s.idx);
    s.names = [m[1]];
  } else {
    s.names = [];
  }
}

// --- 3. classify roots ------------------------------------------------------------------------
// A statement is a ROOT when esbuild had to keep it regardless of whether its bindings are used.
const isRoot = (s) => {
  const head = s.text.slice(0, 200);
  // plain function/class declarations are always droppable
  if (/^(?:async\s+)?function\b/.test(head) || /^class\b/.test(head)) return false;
  if (/^(?:var|let|const)\b/.test(head)) {
    // grab the initializer's first meaningful token
    const eq = s.text.indexOf('=');
    if (eq === -1) return false;
    const init = s.text.slice(eq + 1).trimStart();
    if (init.startsWith('/* @__PURE__ */')) return false;
    // literal / function / arrow / template / new-with-pure initializers are side-effect free
    if (
      /^(?:\(|function\b|async\b|class\b|\{|\[|"|'|`|\d|-\d|null\b|void 0|true\b|false\b|new Map\(\)|new Set\(\)|new WeakMap\(\)|Symbol\b)/.test(
        init,
      )
    ) {
      // an arrow/function/object/array literal is pure; but `[a] = f()` destructuring already
      // handled above (the `=` split gives the initializer of the whole pattern)
      if (/^(?:var|let|const)\s*[[{]/.test(head)) return true; // destructuring: initializer is a call
      // object/array literals can still contain calls; treat a top-level call inside as impure
      return false;
    }
    // identifier alias (`var a = b;`) is pure
    if (/^[A-Za-z_$][\w$]*\s*;?\s*$/.test(init.split('\n')[0])) return false;
    return true;
  }
  if (/^(?:import|export)\b/.test(head)) return false;
  return true; // bare expression statement, etc.
};
for (const s of stmts) s.root = isRoot(s);

// --- 4. reference graph -----------------------------------------------------------------------
const IDENT = /[A-Za-z_$À-￿][\w$À-￿]*/g;
for (const s of stmts) {
  const refs = new Set();
  // strip string literals cheaply so template/HTML content does not create fake edges
  const code = s.text.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''");
  for (const m of code.matchAll(IDENT)) {
    const target = declared.get(m[0]);
    if (target !== undefined && target !== s.idx) refs.add(target);
  }
  s.refs = [...refs];
}

const reachFrom = (seedIdxs) => {
  const seen = new Set(seedIdxs);
  const stack = [...seedIdxs];
  while (stack.length) {
    const cur = stmts[stack.pop()];
    for (const r of cur.refs) if (!seen.has(r)) (seen.add(r), stack.push(r));
  }
  return seen;
};

const roots = stmts.filter((s) => s.root);
const total = stmts.reduce((a, s) => a + s.bytes, 0);

// the entry statement(s): esbuild emits our console.log as a bare expression at the end
const entryStmts = stmts.filter((s) => /^console\.log/.test(s.text)).map((s) => s.idx);

for (const r of roots) {
  r.reachSet = reachFrom([r.idx]);
  r.reach = [...r.reachSet].reduce((a, i) => a + stmts[i].bytes, 0);
}
// exclusive: reachable from this root only
for (const r of roots) {
  const others = roots.filter((o) => o !== r).map((o) => o.idx);
  const otherReach = reachFrom([...others, ...entryStmts]);
  r.exclusive = [...r.reachSet].filter((i) => !otherReach.has(i)).reduce((a, i) => a + stmts[i].bytes, 0);
}

const label = (s) => s.text.split('\n')[0].slice(0, 110);
const sorted = [...roots].sort((a, b) => b.exclusive - a.exclusive || b.reach - a.reach);

console.log(`${file}`);
console.log(`top-level statements: ${stmts.length}  roots: ${roots.length}  total unmin bytes: ${total}`);
console.log(`\nrank  exclusive     reach  line   root declaration`);
for (const [i, s] of sorted.slice(0, topN).entries()) {
  console.log(
    `${String(i + 1).padStart(4)}  ${String(s.exclusive).padStart(9)}  ${String(s.reach).padStart(8)}  ${String(s.line).padStart(5)}  ${label(s)}`,
  );
}
const rootBytes = roots.reduce((a, s) => a + s.bytes, 0);
const allRootReach = reachFrom(roots.map((s) => s.idx));
const rootReachBytes = [...allRootReach].reduce((a, i) => a + stmts[i].bytes, 0);
console.log(`\nroot statements themselves: ${rootBytes} B`);
console.log(
  `reachable from any root:    ${rootReachBytes} B of ${total} B (${((rootReachBytes / total) * 100).toFixed(1)}%)`,
);
const entryReach = reachFrom(entryStmts);
const entryOnly = [...entryReach].filter((i) => !allRootReach.has(i)).reduce((a, i) => a + stmts[i].bytes, 0);
console.log(`reachable only from entry:  ${entryOnly} B`);

if (arg('json')) {
  const jsonPath = assertOutsideRepo(resolve(OUT_ROOT, arg('json')), 'retention report');
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        file,
        totalUnminBytes: total,
        statements: stmts.length,
        roots: sorted.map((s) => ({
          line: s.line,
          decl: label(s),
          names: s.names,
          bytes: s.bytes,
          reach: s.reach,
          exclusive: s.exclusive,
        })),
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(`\nwrote ${jsonPath}`);
}
