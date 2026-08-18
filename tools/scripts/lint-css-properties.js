/**
 * Lints `@property` rules for an initial-value the browser will not accept.
 *
 * A registered custom property needs a *computationally independent* initial-value: one that
 * resolves without reading any other value. Font-relative units (em, rem, ex, ch, lh, cap, ic) and
 * container units (cqw, cqh, cqi, cqb, cqmin, cqmax) are not independent, so Chrome drops the whole
 * @property rule and leaves the token unregistered - silently. Percentages and viewport units are
 * fine. A `syntax: '*'` rule may omit initial-value; every other syntax must carry one.
 *
 * Reach for `syntax: '*'` with no initial-value and a `var(--token, 1em)` fallback at each use site
 * when the default has to be relative.
 *
 * Usage:
 *   node tools/scripts/lint-css-properties.js              # every style file
 *   node tools/scripts/lint-css-properties.js <paths...>   # only these files
 */

const { readFileSync, readdirSync, statSync } = require('fs');
const { join, resolve, relative, extname } = require('path');

const ROOT = resolve(__dirname, '../..');
const SCAN_DIRS = ['libs', 'apps', 'tools'];
const EXTENSIONS = ['.css', '.scss', '.ts', '.html'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'tmp', '.git', '.nx', 'coverage', 'test-results']);

const PROPERTY_RULE = /@property\s+(--[\w-]+)\s*\{([^}]*)\}/g;
const DEPENDENT_UNIT =
  /(?<![\w#-])[\d.]+(em|rem|ex|rex|ch|rch|cap|rcap|ic|ric|lh|rlh|cqw|cqh|cqi|cqb|cqmin|cqmax)(?![\w-])/i;

const collectFiles = (dir, found) => {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;

    const path = join(dir, entry);

    if (statSync(path).isDirectory()) {
      collectFiles(path, found);
    } else if (EXTENSIONS.includes(extname(entry))) {
      found.push(path);
    }
  }

  return found;
};

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

const checkFile = (path) => {
  const text = readFileSync(path, 'utf8');

  if (!text.includes('@property')) return [];

  const problems = [];

  for (const match of text.matchAll(PROPERTY_RULE)) {
    const [, name, body] = match;
    const line = lineOf(text, match.index);
    const syntax = /syntax\s*:\s*'([^']*)'/.exec(body)?.[1]?.trim();
    const initial = /initial-value\s*:\s*([^;]+);/.exec(body)?.[1]?.trim();

    if (!initial) {
      if (syntax && syntax !== '*') {
        problems.push(`${relative(ROOT, path)}:${line}  ${name} declares syntax '${syntax}' but no initial-value`);
      }

      continue;
    }

    const dependent = DEPENDENT_UNIT.exec(initial);

    if (dependent) {
      problems.push(
        `${relative(ROOT, path)}:${line}  ${name} has initial-value '${initial.replace(/\s+/g, ' ')}' — ` +
          `'${dependent[1]}' is not computationally independent, so the rule is dropped`,
      );
    }
  }

  return problems;
};

const args = process.argv.slice(2);
const files = args.length
  ? args.map((path) => resolve(ROOT, path)).filter((path) => EXTENSIONS.includes(extname(path)))
  : SCAN_DIRS.flatMap((dir) => collectFiles(join(ROOT, dir), []));

const problems = files.flatMap(checkFile);

if (problems.length) {
  console.error(`\n@property rules with an initial-value the browser will drop:\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(`\n${problems.length} problem(s). Use an absolute unit, or syntax: '*' with a var() fallback.\n`);
  process.exit(1);
}

console.log(`@property check passed (${files.length} files).`);
