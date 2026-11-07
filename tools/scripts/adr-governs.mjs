import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ADR_FILE = /(^|\/)docs\/adr\/(\d{4})-[^/]+\.md$/;

export const globToRegExp = (glob) => {
  let source = '';
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (char === '*' && glob[i + 1] === '*') {
      source += '.*';
      i++;
      if (glob[i + 1] === '/') i++;
    } else if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`);
};

export const parseAdr = (path, text) => {
  const front = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!front) return null;
  const field = (key) => new RegExp(`^${key}:\\s*(.*)$`, 'm').exec(front[1])?.[1].trim();
  const status = field('status') ?? '';
  const governs = [...(field('governs') ?? '').matchAll(/'([^']*)'|"([^"]*)"|([^\s,[\]]+)/g)].map(
    (m) => m[1] ?? m[2] ?? m[3],
  );
  const title = /^# (.+)$/m.exec(text.slice(front[0].length))?.[1] ?? '';
  return { path, number: ADR_FILE.exec(path)?.[2] ?? '', title, status, governs };
};

export const governingAdrs = (adrs, files) =>
  adrs
    .filter((adr) => !adr.status.startsWith('superseded') && adr.status !== 'rejected' && adr.governs.length)
    .map((adr) => {
      const patterns = adr.governs.map(globToRegExp);
      return { ...adr, matched: files.filter((file) => patterns.some((re) => re.test(file))) };
    })
    .filter((adr) => adr.matched.length);

const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);

export const filesOf = (root, args) => {
  if (args.includes('--staged')) return git(root, ['diff', '--cached', '--name-only']);
  if (args.length === 1 && args[0].includes('..')) return git(root, ['diff', '--name-only', args[0]]);
  return args;
};

export const loadAdrs = (root) =>
  git(root, ['ls-files', '--cached', '--others', '--exclude-standard'])
    .filter((path) => ADR_FILE.test(path))
    .map((path) => parseAdr(path, readFileSync(join(root, path), 'utf8')))
    .filter(Boolean);

export const format = (hits) =>
  hits.map((adr) => [`ADR ${adr.number} ${adr.title} (${adr.path})`, ...adr.matched.map((f) => `  ${f}`)].join('\n'));

const main = () => {
  const root = git(process.cwd(), ['rev-parse', '--show-toplevel'])[0];
  const files = filesOf(root, process.argv.slice(2));
  const hits = governingAdrs(loadAdrs(root), files);
  if (hits.length) console.log(`${format(hits).join('\n')}\nRead these ADRs before you change these files.`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
