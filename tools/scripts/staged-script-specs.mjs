import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSpecs } from './staged-data-specs.mjs';

const root = join(fileURLToPath(import.meta.url), '../../..');
const specDirs = ['tools/scripts', 'apps/ethlete-studio/eslint-rules'];

export const toolFiles = (repoRoot = root) =>
  specDirs.flatMap((dir) =>
    readdirSync(join(repoRoot, dir))
      .filter((name) => /\.(mjs|js)$/.test(name))
      .map((name) => `${dir}/${name}`),
  );

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const mentions = (source, file) => new RegExp(`['"\`/]${escape(basename(file))}['"\`]`).test(source);

export const specsForScripts = (files, tools, read) => {
  const reached = new Set(files);
  const scripts = tools.filter((file) => !file.endsWith('.spec.mjs'));

  for (let grew = true; grew;) {
    grew = false;
    for (const script of scripts)
      if (!reached.has(script) && [...reached].some((file) => mentions(read(script), file))) {
        reached.add(script);
        grew = true;
      }
  }

  return tools
    .filter((file) => file.endsWith('.spec.mjs'))
    .filter((spec) => reached.has(spec) || [...reached].some((file) => mentions(read(spec), file)));
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sources = new Map();
  const read = (file) => sources.get(file) ?? sources.set(file, readFileSync(join(root, file), 'utf8')).get(file);
  const specs = specsForScripts(process.argv.slice(2), toolFiles(), read);

  if (specs.length) console.log(`staged-script-specs: ${specs.length} spec(s) import or copy a staged script.`);
  process.exit(specs.length ? runSpecs(specs) : 0);
}
