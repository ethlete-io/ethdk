import { spawnSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { readReportConfig } from './config';

const ID = '[A-Z]\\d+b?';
const REFS = `${ID}(?:\\s*[,-]\\s*${ID})*`;
const WORK_TYPES = ['feat', 'fix', 'perf', 'refactor', 'revert', 'test', 'build', 'ci'];
const TYPE_ORDER = [...WORK_TYPES, 'docs', 'chore', 'style'];
const CI_TIMEOUT_MS = 15_000;
const REASON_MAX = 140;

type Period = { from: Date; to: Date };

export type CiResult = { failed: number; total: number } | null;

export type ReportOptions = {
  root: string;
  from: Date;
  to: Date;
  planFiles: string[];
  ci: (query: { branch: string; from: Date; to: Date }) => CiResult;
};

type Commit = { sha: string; time: Date; type: string; subject: string; refs: string[] };

type PlanRow = { id: string; name: string; stand: string; missing: string };

export const parsePeriod = (argv: readonly string[], now: Date): { from: Date; to: Date } | { error: string } => {
  const startOfDay = (offsetDays: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - offsetDays);
  let preset: string | undefined;
  let since: string | undefined;
  let until: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] ?? '';

    if (argument === '--since' || argument === '--until') {
      const value = argv[++index];

      if (!value || value.startsWith('-')) return { error: `${argument} needs a value.` };

      if (argument === '--since') since = value;
      else until = value;
    } else if (['today', 'yesterday', 'week'].includes(argument) && preset === undefined) {
      preset = argument;
    } else {
      return {
        error: `Unexpected argument "${argument}". Use today, yesterday, week or --since <date> [--until <date>].`,
      };
    }
  }

  if (since !== undefined || until !== undefined) {
    if (preset !== undefined) return { error: `"${preset}" cannot be combined with --since or --until.` };
    if (since === undefined) return { error: '--until needs --since.' };

    const from = parseMoment(since);
    const to = until === undefined ? now : parseMoment(until);

    if (!from) return { error: `Invalid date "${since}".` };
    if (!to) return { error: `Invalid date "${until}".` };
    if (from > to) return { error: '--since must not be later than --until.' };

    return { from, to };
  }

  if (preset === 'yesterday') return { from: startOfDay(1), to: now };
  if (preset === 'week') return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), to: now };

  return { from: startOfDay(0), to: now };
};

const parseMoment = (text: string) => {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const date = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(text);

  return Number.isNaN(date.getTime()) ? null : date;
};

const run = (cwd: string, command: string[]) => {
  const result = spawnSync(command[0] ?? '', command.slice(1), { cwd, encoding: 'utf8', timeout: CI_TIMEOUT_MS });

  return result.status === 0 ? result.stdout : null;
};

const git = (cwd: string, ...args: string[]) => run(cwd, ['git', ...args])?.trim() ?? null;

const pad = (value: number) => String(value).padStart(2, '0');

const formatMoment = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;

const formatClock = (date: Date, reference: Date) =>
  date.toDateString() === reference.toDateString()
    ? `${pad(date.getHours())}:${pad(date.getMinutes())}`
    : `${pad(date.getDate())}.${pad(date.getMonth() + 1)}. ${pad(date.getHours())}:${pad(date.getMinutes())}`;

const cell = (text: string) =>
  text
    .replace(/\|/g, '\\|')
    .replace(/\s*\n\s*/g, ' ')
    .trim();

const readCommits = (root: string, { from, to }: Period): Commit[] => {
  const output = git(root, 'log', '--no-merges', `--since=${from.toISOString()}`, '--format=%h%x1f%aI%x1f%s%x1e');

  if (!output) return [];

  const refPattern = new RegExp(`\\((${REFS})\\)`, 'g');
  const commits: Commit[] = [];

  for (const record of output.split('\x1e')) {
    const [sha, iso, subject] = record.trim().split('\x1f');

    if (!sha || !iso || subject === undefined) continue;

    const time = new Date(iso);

    if (time < from || time > to) continue;

    const type = /^(\w+)(?:\([^)]*\))?!?: /.exec(subject)?.[1] ?? 'other';
    const refs = new Set<string>();

    for (const match of subject.matchAll(refPattern)) {
      for (const id of (match[1] ?? '').match(new RegExp(ID, 'g')) ?? []) refs.add(id);
    }

    commits.push({ sha, time, type, subject, refs: [...refs] });
  }

  return commits.reverse();
};

const expandPlanFiles = (root: string, patterns: string[]) => {
  const files: string[] = [];

  for (const pattern of patterns) {
    if (!/[*?]/.test(pattern)) {
      if (existsSync(join(root, pattern))) files.push(pattern);
      continue;
    }

    const regex = new RegExp(
      `^${pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*\/?/g, '@@GLOBSTAR@@')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]')
        .replace(/@@GLOBSTAR@@/g, '(?:.*/)?')}$`,
    );
    const base = pattern.slice(0, pattern.search(/[*?]/));
    const baseDir = base.includes('/') ? base.slice(0, base.lastIndexOf('/')) : '';
    const start = join(root, baseDir);

    if (!existsSync(start)) continue;

    const matches = (readdirSync(start, { recursive: true }) as string[])
      .map((entry) => (baseDir ? `${baseDir}/${entry}` : entry).split('\\').join('/'))
      .filter((entry) => !entry.split('/').includes('node_modules') && regex.test(entry))
      .sort();

    files.push(...matches);
  }

  return [...new Set(files)];
};

const readPlan = (root: string, patterns: string[]) => {
  const rows = new Map<string, PlanRow>();
  const queueNames = new Map<string, string>();

  for (const file of expandPlanFiles(root, patterns)) {
    for (const line of readFileSync(join(root, file), 'utf8').split('\n')) {
      if (line.startsWith('|')) {
        const cells = line
          .replace(/^\||\|\s*$/g, '')
          .split(/(?<!\\)\|/)
          .map((entry) => entry.replace(/\\\|/g, '|').trim());
        const id = cells[0] ?? '';

        if (new RegExp(`^${ID}$`).test(id) && !rows.has(id)) {
          rows.set(id, { id, name: cells[1] ?? '', stand: cells[3] ?? '', missing: cells[4] ?? '' });
        }

        continue;
      }

      const queued = new RegExp(`^\\d+\\.\\s+\\*\\*(.+?)\\s+\\((${ID})\\)\\*\\*`).exec(line);

      if (queued?.[1] && queued[2] && !queueNames.has(queued[2])) queueNames.set(queued[2], queued[1]);
    }
  }

  return { rows, queueNames };
};

const firstSentence = (text: string) => {
  const sentence = text.split(/(?<=[.!?])\s/)[0] ?? text;

  return sentence.length > REASON_MAX ? `${sentence.slice(0, REASON_MAX - 1).trimEnd()}…` : sentence;
};

const stripSubject = (subject: string) =>
  subject
    .replace(/^\w+(?:\([^)]*\))?!?: /, '')
    .replace(new RegExp(`\\s*\\(${REFS}\\)(?=["']?$)`), '')
    .trim();

const resultOf = (commit: Commit) =>
  `${commit.type === 'revert' ? 'Zurückgenommen: ' : ''}${stripSubject(commit.subject)}`;

const shaCell = (commits: Commit[]) => {
  const latest = commits[commits.length - 1] as Commit;

  return commits.length > 1 ? `${latest.sha} +${commits.length - 1}` : latest.sha;
};

const readSlice = (root: string) => {
  const path = git(root, 'rev-parse', '--git-path', 'slice-paths');

  if (!path || !existsSync(resolve(root, path))) return null;

  const text = readFileSync(resolve(root, path), 'utf8');
  const name = /^#\s*slice:\s*(.+)$/m.exec(text)?.[1]?.trim();
  const written = /^#\s*written:\s*(.+)$/m.exec(text)?.[1]?.trim();

  if (!name) return null;

  return { name, since: written ? parseMoment(written) : null };
};

const readSubagentStarts = (root: string, { from, to }: Period) => {
  const common = git(root, 'rev-parse', '--git-common-dir');
  const path = common ? join(resolve(root, common), 'ethlete', 'subagent-starts.jsonl') : null;

  if (!path || !existsSync(path)) return null;

  const counts = new Map<string, number>();

  for (const line of readFileSync(path, 'utf8').split('\n')) {
    try {
      const entry = JSON.parse(line) as { time?: string; model?: string };
      const time = entry.time ? new Date(entry.time) : null;

      if (!entry.model || !time || time < from || time > to) continue;

      counts.set(entry.model, (counts.get(entry.model) ?? 0) + 1);
    } catch {
      continue;
    }
  }

  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};

export const ghCiResult = ({ branch, from, to }: { branch: string; from: Date; to: Date }): CiResult => {
  const stamp = (date: Date) => date.toISOString().replace(/\.\d+Z$/, 'Z');
  const output = run(process.cwd(), [
    'gh',
    'run',
    'list',
    '--branch',
    branch,
    '--created',
    `${stamp(from)}..${stamp(to)}`,
    '--limit',
    '100',
    '--json',
    'conclusion',
  ]);

  if (!output) return null;

  try {
    const runs = JSON.parse(output) as { conclusion?: string }[];

    return { failed: runs.filter((entry) => entry.conclusion === 'failure').length, total: runs.length };
  } catch {
    return null;
  }
};

export const buildReport = (options: ReportOptions) => {
  const { root, from, to } = options;
  const commits = readCommits(root, { from, to });
  const plan = readPlan(root, options.planFiles);
  const label = (id: string) => {
    const name = plan.rows.get(id)?.name || plan.queueNames.get(id);

    return name ? `${name} (${id})` : id;
  };
  const lines = [`## Bericht ${formatMoment(from)} – ${formatMoment(to)}`, ''];
  const work = commits.filter((commit) => WORK_TYPES.includes(commit.type));

  if (commits.length === 0) {
    lines.push('Keine Commits im Zeitraum.');
  } else {
    const byRow = new Map<string, Commit[]>();
    const loose: Commit[] = [];

    for (const commit of work) {
      if (commit.refs.length === 0) loose.push(commit);

      for (const id of commit.refs) byRow.set(id, [...(byRow.get(id) ?? []), commit]);
    }

    const entries = [...byRow]
      .map(([id, list]) => ({ zeile: label(id), list, id }))
      .concat(loose.length ? [{ zeile: '—', list: loose, id: '' }] : [])
      .sort(
        (a, b) =>
          (a.list[a.list.length - 1] as Commit).time.getTime() - (b.list[b.list.length - 1] as Commit).time.getTime() ||
          a.id.localeCompare(b.id),
      );

    if (entries.length === 0) {
      lines.push('Keine fertigen Zeilen im Zeitraum.');
    } else {
      lines.push('| Zeile | Commit | Ergebnis |', '| - | - | - |');

      for (const { zeile, list } of entries) {
        lines.push(`| ${cell(zeile)} | ${shaCell(list)} | ${cell(resultOf(list[list.length - 1] as Commit))} |`);
      }
    }
  }

  const parked = [...plan.rows.values()].filter((row) => row.stand.includes('⏸️'));

  if (parked.length) {
    lines.push('', '**Geparkt**', '| Zeile | Grund |', '| - | - |');

    for (const row of parked) lines.push(`| ${cell(label(row.id))} | ${cell(firstSentence(row.missing))} |`);
  }

  const typeCounts = new Map<string, number>();

  for (const commit of commits) typeCounts.set(commit.type, (typeCounts.get(commit.type) ?? 0) + 1);

  const types = [...typeCounts]
    .sort(
      ([a], [b]) =>
        (TYPE_ORDER.indexOf(a) + 1 || TYPE_ORDER.length + 1) - (TYPE_ORDER.indexOf(b) + 1 || TYPE_ORDER.length + 1) ||
        a.localeCompare(b),
    )
    .map(([type, count]) => `${count} ${type}`);
  const reverts = typeCounts.get('revert') ?? 0;
  const branch = git(root, 'rev-parse', '--abbrev-ref', 'HEAD') ?? '';
  const ci = branch ? options.ci({ branch, from, to }) : null;
  const starts = readSubagentStarts(root, { from, to });
  const slice = readSlice(root);
  const figures = [
    `${commits.length} Commits${types.length ? ` (${types.join(', ')})` : ''}`,
    ...(reverts ? [`${reverts} ${reverts === 1 ? 'Revert' : 'Reverts'}`] : []),
    ci && ci.total > 0 ? `CI ${ci.failed}/${ci.total} rot` : 'CI: n/a',
    ...(starts?.length ? [`Subagenten: ${starts.map(([model, count]) => `${model} ${count}`).join(', ')}`] : []),
    ...(slice ? [`Slice läuft: ${slice.name}${slice.since ? ` seit ${formatClock(slice.since, to)}` : ''}`] : []),
  ];

  lines.push('', `**Kennzahlen:** ${figures.join(' · ')}`);

  return lines.join('\n');
};

export const reportCommand = (options: { root: string; argv: string[]; now?: Date; ci?: ReportOptions['ci'] }) => {
  const period = parsePeriod(options.argv, options.now ?? new Date());

  if ('error' in period) {
    console.error(period.error);

    return 1;
  }

  const top = git(options.root, 'rev-parse', '--show-toplevel');

  if (!top) {
    console.error('ethlete-agents report must run inside a git repository.');

    return 1;
  }

  console.log(
    buildReport({
      root: top,
      ...period,
      planFiles: readReportConfig(options.root).planFiles ?? [],
      ci: options.ci ?? ghCiResult,
    }),
  );

  return 0;
};
