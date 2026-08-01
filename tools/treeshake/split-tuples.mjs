#!/usr/bin/env node
/**
 * Rewrite top-level tuple-destructuring factory declarations in a linked-FESM cache into a
 * per-binding, PURE-annotatable shape — the simulation of "what if create*Provider / createLabels
 * did not hand back an array to destructure".
 *
 *   const [provideX, injectX, TOKEN] = createRootProvider(ARGS);
 * becomes
 *   const __etTup0 = () => createRootProvider(ARGS);          // arrow decl: always droppable
 *   const provideX = PURE __etTupleGet(__etTup0, 0); // PURE = a #__PURE__ annotation; droppable when unused
 *   const injectX  = PURE __etTupleGet(__etTup0, 1);
 *   const TOKEN    = PURE __etTupleGet(__etTup0, 2);
 *
 * `__etTupleGet` memoizes the tuple, so runtime semantics (one shared InjectionToken per
 * declaration) are preserved while each binding becomes independently removable.
 *
 * Usage: node tools/treeshake/split-tuples.mjs <cache-dir> [--callees a,b,c]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { assertOutsideRepo } from './harness.mjs';

const [dirArg, ...rest] = process.argv.slice(2);
if (!dirArg) throw new Error('usage: split-tuples.mjs <cache-dir> [--callees a,b,c]');
// rewrites the cache in place, so it must be a copy made by make-pure-variant.mjs, never the repo
const dir = assertOutsideRepo(dirArg, 'variant cache');
const arg = (n, d) => {
  const i = rest.indexOf(`--${n}`);
  return i === -1 ? d : rest[i + 1];
};
const callees = arg(
  'callees',
  'createLabels,createStaticRootProvider,createRootProvider,createProvider,createStaticProvider',
).split(',');

const HELPER = `const __etTupleCache = /*#__PURE__*/ new WeakMap();
const __etTupleGet = (make, index) => {
  let t = __etTupleCache.get(make);
  if (t === undefined) { t = make(); __etTupleCache.set(make, t); }
  return t[index];
};
`;

/** find the index just past the matching ')' for the '(' at openIdx */
const matchParen = (s, openIdx) => {
  let depth = 0;
  let i = openIdx;
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
        if (q === '`' && s[i] === '$' && s[i + 1] === '{') {
          // nested template expression: recurse on the brace group
          let d = 1;
          i += 2;
          while (i < s.length && d > 0) {
            if (s[i] === '{') d++;
            else if (s[i] === '}') d--;
            else if (s[i] === '"' || s[i] === "'" || s[i] === '`') {
              const q2 = s[i++];
              while (i < s.length && s[i] !== q2) i += s[i] === '\\' ? 2 : 1;
            }
            i++;
          }
          continue;
        }
        i++;
      }
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return i + 1;
    }
    i++;
  }
  return -1;
};

const rewriteFile = (p) => {
  const src = readFileSync(p, 'utf8');
  const alt = callees.join('|');
  const re = new RegExp(
    `^(?:const|let|var)\\s*\\[([^\\]]*)\\]\\s*=\\s*(?:/\\*#__PURE__\\*/\\s*)?(${alt})\\s*\\(`,
    'gm',
  );
  let out = '';
  let last = 0;
  let n = 0;
  let m;
  while ((m = re.exec(src))) {
    const stmtStart = m.index;
    const openIdx = src.indexOf('(', m.index + m[0].length - 1);
    const end = matchParen(src, openIdx);
    if (end === -1) continue;
    const names = m[1].split(',').map((x) => x.trim());
    const args = src.slice(openIdx, end); // includes the parens
    const id = `__etTup${n}`;
    const decls = [`const ${id} = () => ${m[2]}${args};`];
    names.forEach((name, i) => {
      if (!name) return;
      decls.push(`const ${name} = /*#__PURE__*/ __etTupleGet(${id}, ${i});`);
    });
    out += src.slice(last, stmtStart) + decls.join('\n');
    // skip the trailing `;` of the original statement
    let after = end;
    while (after < src.length && /[\s;]/.test(src[after]) && src[after] !== '\n') after++;
    last = after;
    re.lastIndex = after;
    n++;
  }
  out += src.slice(last);
  if (!n) return 0;
  writeFileSync(p, `${HELPER}${out}`, 'utf8');
  return n;
};

let total = 0;
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) {
      walk(p);
      continue;
    }
    if (!p.endsWith('.mjs')) continue;
    const n = rewriteFile(p);
    total += n;
    console.log(`${String(n).padStart(4)}  ${p.replace(dir, '')}`);
  }
};
walk(dir);
console.log(`split ${total} tuple declarations in ${dir}`);
