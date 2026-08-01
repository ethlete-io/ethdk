#!/usr/bin/env node
/**
 * Copy a linked-FESM cache dir and inject a `#__PURE__` annotation before top-level call initializers,
 * so measure-bundle.mjs can be pointed at it with --cache and measure "what if these were pure".
 *
 * Usage: node tools/treeshake/make-pure-variant.mjs <src-cache> <dst-cache> <tier>
 *   tier A = the provider/label factory family only
 *   tier B = A + other library factories (memoizeSignal, createPropertyBinding, query templates, …)
 *   tier C = B + new Set/Map/Date/WeakMap/Symbol/signal/Object.keys
 */
import { cpSync, readFileSync, writeFileSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { assertOutsideRepo } from './harness.mjs';

const [srcArg, dstArg, tier = 'A'] = process.argv.slice(2);
if (!srcArg || !dstArg) throw new Error('usage: make-pure-variant.mjs <src-cache> <dst-cache> <tier A|B|C>');
const src = resolve(srcArg);
const dst = assertOutsideRepo(dstArg, 'variant cache');

const TIERS = {
  A: ['createLabels', 'createStaticRootProvider', 'createRootProvider', 'createProvider', 'createStaticProvider'],
  B: [
    'createLabels',
    'createStaticRootProvider',
    'createRootProvider',
    'createProvider',
    'createStaticProvider',
    'memoizeSignal',
    'createPropertyBinding',
    'createManagedMetadataKey',
    'createQueryTemplate',
    'createSecureQueryTemplate',
    'createGqlCreatorTemplate',
    'createSecureGqlCreatorTemplate',
  ],
  C: [
    'createLabels',
    'createStaticRootProvider',
    'createRootProvider',
    'createProvider',
    'createStaticProvider',
    'memoizeSignal',
    'createPropertyBinding',
    'createManagedMetadataKey',
    'createQueryTemplate',
    'createSecureQueryTemplate',
    'createGqlCreatorTemplate',
    'createSecureGqlCreatorTemplate',
    'new Set',
    'new Map',
    'new WeakMap',
    'new Date',
    'Symbol',
    'Object.keys',
    'signal',
    'entries.asReadonly',
  ],
};
const callees = TIERS[tier];
if (!callees) throw new Error(`unknown tier ${tier}`);

if (existsSync(dst)) rmSync(dst, { recursive: true, force: true });
cpSync(src, dst, { recursive: true });
// drop stale entry files / dumps from the copy
const entries = join(dst, 'entries');
if (existsSync(entries)) rmSync(entries, { recursive: true, force: true });
for (const f of readdirSync(dst)) if (statSync(join(dst, f)).isFile()) rmSync(join(dst, f));

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alt = callees.map(esc).join('|');
// top-level `const|let|var <binding> = <callee>(`  ->  insert the annotation
const re = new RegExp(
  `^((?:const|let|var)\\s+(?:\\[[^\\]]*\\]|\\{[^}]*\\}|[A-Za-z_$][\\w$]*)\\s*=\\s*)((?:${alt})\\s*\\()`,
  'gm',
);

let totalHits = 0;
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) {
      walk(p);
      continue;
    }
    if (!p.endsWith('.mjs')) continue;
    const before = readFileSync(p, 'utf8');
    let hits = 0;
    const after = before.replace(re, (_m, head, call) => {
      hits++;
      return `${head}/*#__PURE__*/${call}`;
    });
    if (hits) writeFileSync(p, after, 'utf8');
    totalHits += hits;
    console.log(`${String(hits).padStart(4)}  ${p.replace(dst, '')}`);
  }
};
walk(dst);
console.log(`tier ${tier}: annotated ${totalHits} declarations -> ${dst}`);
