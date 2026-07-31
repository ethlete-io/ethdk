#!/usr/bin/env node
/**
 * Wrap top-level object/array-literal initializers that contain a member access (`[ENUM.KEY]:`,
 * `label: DEFAULTS.foo`) in a PURE-annotated IIFE, so esbuild may drop them when unused.
 * esbuild treats a bare property read as a possible getter call, i.e. a side effect, which pins
 * the whole declaration and everything it references.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { assertOutsideRepo } from './harness.mjs';

// Usage: node tools/treeshake/wrap-literals.mjs <cache-dir>
// Rewrites the cache in place, so it must be a copy made by make-pure-variant.mjs.
if (!process.argv[2]) throw new Error('usage: wrap-literals.mjs <cache-dir>');
const dir = assertOutsideRepo(process.argv[2], 'variant cache');

const matchBracket = (s, open) => {
  const pairs = { '{': '}', '[': ']', '(': ')' };
  const close = pairs[s[open]];
  let depth = 0,
    i = open;
  while (i < s.length) {
    const c = s[i];
    if (c === '/' && s[i + 1] === '/') {
      i = s.indexOf('\n', i);
      if (i === -1) return -1;
      continue;
    }
    if (c === '/' && s[i + 1] === '*') {
      i = s.indexOf('*/', i + 2);
      if (i === -1) return -1;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      i++;
      while (i < s.length) {
        if (s[i] === '\\') {
          i += 2;
          continue;
        }
        if (s[i] === q) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (c === s[open]) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return i + 1;
    }
    i++;
  }
  return -1;
};

let total = 0;
const rewrite = (p) => {
  const src = readFileSync(p, 'utf8');
  const lines = src.split('\n');
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.length || /^\s/.test(l) || /^[})\]]/.test(l)) continue;
    starts.push(i);
  }
  const edits = [];
  let offset = 0;
  const lineOffsets = lines.map((l) => {
    const o = offset;
    offset += l.length + 1;
    return o;
  });
  for (let k = 0; k < starts.length; k++) {
    const s = starts[k];
    const head = lines[s];
    if (!/^(const|let|var)\s/.test(head)) continue;
    const stmtStart = lineOffsets[s];
    const eq = src.indexOf('=', stmtStart);
    if (eq === -1) continue;
    let i = eq + 1;
    while (i < src.length && /\s/.test(src[i])) i++;
    if (src[i] !== '{' && src[i] !== '[') continue;
    const end = matchBracket(src, i);
    if (end === -1) continue;
    const init = src.slice(i, end);
    if (!/(?:^|[\s,:[({])(?:[A-Za-z_$][\w$]*)\.[A-Za-z_$][\w$]*/.test(init.replace(/=>[^,\n]*/g, ''))) continue;
    edits.push([i, end, init]);
  }
  if (!edits.length) return 0;
  let out = '',
    last = 0;
  for (const [a, b, init] of edits) {
    out += src.slice(last, a) + `/*#__PURE__*/ (() => (${init}))()`;
    last = b;
  }
  out += src.slice(last);
  writeFileSync(p, out, 'utf8');
  return edits.length;
};
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) {
      walk(p);
      continue;
    }
    if (p.endsWith('.mjs')) total += rewrite(p);
  }
};
walk(dir);
console.log(`wrapped ${total} literal initializers in ${dir}`);
