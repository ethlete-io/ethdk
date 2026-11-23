import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const STATUS_VALUE = /^(accepted|superseded by \d{4})$/;
const PARTS_VALUE = /^\[\s*([a-z-]+\/[a-z0-9-]+(\s*,\s*[a-z-]+\/[a-z0-9-]+)*)\s*\]$/;

export const frontmatterOf = (text) => {
  const match = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!match) return null;
  return Object.fromEntries(
    match[1]
      .split('\n')
      .map((line) => /^([A-Za-z-]+):\s*(.*)$/.exec(line))
      .filter(Boolean)
      .map((m) => [m[1], m[2].trim()]),
  );
};

export const partsOf = (value) => PARTS_VALUE.exec(value ?? '')?.[1].split(/\s*,\s*/) ?? [];

export const checkAdr = (name, text, partExists = () => true) => {
  const errors = [];
  const warnings = [];
  const meta = frontmatterOf(text);
  if (!meta) return { errors: [`${name}: no frontmatter`], warnings };
  if (!STATUS_VALUE.test(meta.status ?? '')) {
    errors.push(`${name}: status must be "accepted" or "superseded by NNNN", got "${meta.status ?? ''}"`);
  }
  if ('parts' in meta) {
    if (!PARTS_VALUE.test(meta.parts)) {
      errors.push(`${name}: parts must be a list like [components/title-bar], got "${meta.parts}"`);
    } else {
      for (const part of partsOf(meta.parts)) {
        if (!partExists(part)) errors.push(`${name}: parts names ${part}, which is not a design part`);
      }
    }
  }
  return { errors, warnings };
};

const ADR_DIRS = ['apps/ethlete-studio/docs/adr', 'docs/adr'];

const partExistsIn = (root) => {
  const designDir = join(root, '.ethlete/design');
  const products = existsSync(designDir) ? readdirSync(designDir) : [];
  return (part) => {
    const name = part.split('/')[1];
    return products.some((product) => existsSync(join(designDir, product, part, `${name}.ts`)));
  };
};

export const checkAdrs = (root) => {
  const files = ADR_DIRS.flatMap((rel) => {
    const dir = join(root, rel);
    return existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => f.endsWith('.md'))
          .map((f) => ({ path: `${rel}/${f}`, file: join(dir, f) }))
      : [];
  });
  const partExists = partExistsIn(root);
  const results = files.map((f) => checkAdr(f.path, readFileSync(f.file, 'utf8'), partExists));
  const seen = new Map();
  const duplicates = [];
  for (const { path } of files) {
    const number = /\/(\d{4})-[^/]*$/.exec(path)?.[1];
    if (!number) continue;
    if (seen.has(number)) duplicates.push(`ADR number ${number} is used twice: ${seen.get(number)} and ${path}`);
    else seen.set(number, path);
  }
  return {
    errors: [...duplicates, ...results.flatMap((r) => r.errors)],
    warnings: results.flatMap((r) => r.warnings),
  };
};

export const warningLines = (warnings, { summary = false } = {}) => {
  if (!summary || warnings.length === 0) return warnings.map((w) => `warning: ${w}`);

  return [`warning: ${warnings.length} studio ADR warning(s); run \`yarn lint:studio-adrs\` for the list`];
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { errors, warnings } = checkAdrs(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
  for (const line of warningLines(warnings, { summary: process.argv.includes('--summary') })) console.warn(line);
  for (const e of errors) console.error(e);
  if (errors.length) process.exit(1);
  console.log('studio ADRs ok');
}
