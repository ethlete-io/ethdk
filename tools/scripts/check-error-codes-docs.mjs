import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url).pathname;

const pages = {
  components: 'apps/docs/components/error-codes.md',
  core: 'apps/docs/components/error-codes.md',
  bracket: 'apps/docs/components/error-codes.md',
  contentful: 'apps/docs/contentful/index.md',
  query: 'apps/docs/query/errors.md',
};

const files = execSync(
  `git ls-files -co --exclude-standard ${Object.keys(pages)
    .map((l) => `'libs/${l}/src/**/*.ts'`)
    .join(' ')}`,
  {
    cwd: root,
  },
)
  .toString()
  .split('\n')
  .filter((f) => f && !/\.(spec|stories)\.ts$/.test(f) && !/\/(scenarios|testing)\//.test(f));

const definitionStart = /(?:const\s+\w*(?:_CODES?|ErrorCode)\b[^={]*=\s*\{|enum\s+\w*Code\w*\s*\{)/g;
const member = /^\s*(\w+)\s*[:=]\s*(\d+)\b/gm;
const literalSite = [
  /new\s+\w*RuntimeError\s*(?:<[^>(]*>)?\(\s*(\d+)\s*[,)]/g,
  /formatRuntimeError\s*(?:<[^>(]*>)?\(\s*(\d+)\s*[,)]/g,
  /['"`]ET(\d+):/g,
];

const defined = [];

for (const file of files) {
  let text;
  try {
    text = readFileSync(root + file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
  } catch {
    continue;
  }
  const lib = file.split('/')[1];

  for (const pattern of literalSite) {
    for (const m of text.matchAll(pattern)) {
      defined.push({ lib, name: '(bare literal)', code: Number(m[1]), file });
    }
  }

  if (!/_CODES?\b|Code\w*\s*(?:=\s*)?\{/.test(text)) continue;

  for (const start of text.matchAll(definitionStart)) {
    const body = text.slice(start.index + start[0].length, text.indexOf('}', start.index + start[0].length));
    for (const m of body.matchAll(member)) {
      defined.push({ lib, name: m[1], code: Number(m[2]), file });
    }
  }
}

const pageCodes = new Map();
const documentedIn = (page) => {
  if (!pageCodes.has(page)) {
    const text = readFileSync(root + page, 'utf8');
    pageCodes.set(page, new Set([...text.matchAll(/\bET(\d+)\b/g)].map((m) => Number(m[1]))));
  }
  return pageCodes.get(page);
};

const missing = defined.filter((d) => !documentedIn(pages[d.lib]).has(d.code));

if (defined.length === 0) {
  console.error('check-error-codes-docs: found no error codes - the collector is broken.');
  process.exit(1);
}

const named = new Map();
const duplicates = [];
for (const d of defined.filter((d) => d.name !== '(bare literal)')) {
  const key = `${d.lib}:${d.code}`;
  const first = named.get(key);
  if (first && first.name !== d.name) duplicates.push([first, d]);
  else if (!first) named.set(key, d);
}

if (duplicates.length) {
  console.error(`${duplicates.length} error code(s) are declared twice within one lib:\n`);
  for (const [a, b] of duplicates) {
    console.error(`  ET${a.code} ${a.name} (${a.file}) and ${b.name} (${b.file})`);
  }
}

if (missing.length) {
  console.error(`${missing.length} error code(s) have no row on their docs page:\n`);
  for (const d of missing.sort((a, b) => a.code - b.code)) {
    console.error(`  ET${d.code} ${d.name} (${d.file}) -> ${pages[d.lib]}`);
  }
}

if (missing.length || duplicates.length) process.exit(1);

console.log(`All ${defined.length} error codes are documented.`);
