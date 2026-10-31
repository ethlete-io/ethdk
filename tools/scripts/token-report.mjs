import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const resultSize = (content) =>
  typeof content === 'string'
    ? content.length
    : Array.isArray(content)
      ? content.reduce((n, part) => n + (part.text?.length ?? 0), 0)
      : 0;

export const analyzeTranscript = (text) => {
  const requests = new Map();
  const uses = new Map();
  const results = [];
  const reads = new Map();

  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const content = entry.message?.content;
    if (entry.type === 'assistant' && entry.message?.usage) {
      requests.set(entry.message.id ?? entry.uuid, entry.message.usage);
      for (const part of Array.isArray(content) ? content : []) {
        if (part.type !== 'tool_use') continue;
        uses.set(part.id, part.name);
        if (part.name === 'Read' && part.input?.file_path) {
          reads.set(part.input.file_path, (reads.get(part.input.file_path) ?? 0) + 1);
        }
      }
    } else if (entry.type === 'user' && Array.isArray(content)) {
      for (const part of content) {
        if (part.type === 'tool_result') {
          results.push({ tool: uses.get(part.tool_use_id) ?? '?', chars: resultSize(part.content) });
        }
      }
    }
  }

  const usages = [...requests.values()];
  const sum = (key) => usages.reduce((n, u) => n + (u[key] ?? 0), 0);
  const first = usages[0];
  return {
    requests: usages.length,
    input: sum('input_tokens'),
    cacheRead: sum('cache_read_input_tokens'),
    cacheCreate: sum('cache_creation_input_tokens'),
    output: sum('output_tokens'),
    start: first
      ? (first.input_tokens ?? 0) + (first.cache_read_input_tokens ?? 0) + (first.cache_creation_input_tokens ?? 0)
      : 0,
    topResults: results.sort((a, b) => b.chars - a.chars).slice(0, 10),
    topReads: [...reads.entries()]
      .filter(([, n]) => n > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10),
  };
};

export const collectTranscripts = (dir, sinceMs) => {
  const found = [];
  if (!existsSync(dir)) return found;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name.endsWith('.jsonl')) found.push({ id: basename(name, '.jsonl'), kind: 'session', path });
    else if (statSync(path).isDirectory() && existsSync(join(path, 'subagents'))) {
      for (const sub of readdirSync(join(path, 'subagents'))) {
        if (sub.endsWith('.jsonl')) {
          found.push({
            id: `${name.slice(0, 8)}/${basename(sub, '.jsonl')}`,
            kind: 'subagent',
            path: join(path, 'subagents', sub),
          });
        }
      }
    }
  }
  return found.filter((t) => statSync(t.path).mtimeMs >= sinceMs);
};

const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export const renderReport = (rows, top = 15) => {
  const out = [];
  const head = ['kind', 'id', 'reqs', 'input', 'cacheRd', 'cacheNew', 'output', 'start'];
  out.push(head.join('\t'));
  for (const r of rows.slice(0, top)) {
    const a = r.analysis;
    out.push(
      [
        r.kind,
        r.id.slice(0, 40),
        a.requests,
        k(a.input),
        k(a.cacheRead),
        k(a.cacheCreate),
        k(a.output),
        k(a.start),
      ].join('\t'),
    );
  }
  const total = (key) => rows.reduce((n, r) => n + r.analysis[key], 0);
  out.push(
    [
      'TOTAL',
      `${rows.length} transcripts`,
      total('requests'),
      k(total('input')),
      k(total('cacheRead')),
      k(total('cacheCreate')),
      k(total('output')),
      '',
    ].join('\t'),
  );
  const results = rows
    .flatMap((r) => r.analysis.topResults.map((x) => ({ ...x, id: r.id })))
    .sort((a, b) => b.chars - a.chars)
    .slice(0, 10);
  out.push('', 'largest tool results (chars):');
  for (const x of results) out.push(`  ${k(x.chars)}\t${x.tool}\t${x.id.slice(0, 40)}`);
  const reads = new Map();
  for (const r of rows) for (const [file, n] of r.analysis.topReads) reads.set(file, (reads.get(file) ?? 0) + n);
  out.push('', 'files read repeatedly within a transcript (count):');
  for (const [file, n] of [...reads.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) out.push(`  ${n}\t${file}`);
  return out.join('\n');
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const daysIndex = args.indexOf('--days');
  const days = daysIndex >= 0 ? Number(args[daysIndex + 1]) : 7;
  const dirIndex = args.indexOf('--dir');
  const dir = dirIndex >= 0 ? args[dirIndex + 1] : join(homedir(), '.claude/projects/-home-tom-dev-ethlete-sdk');
  const rows = collectTranscripts(dir, Date.now() - days * 86400000).map((t) => ({
    ...t,
    analysis: analyzeTranscript(readFileSync(t.path, 'utf8')),
  }));
  rows.sort((a, b) => b.analysis.cacheCreate + b.analysis.output - (a.analysis.cacheCreate + a.analysis.output));
  const topIndex = args.indexOf('--top');
  console.log(renderReport(rows, topIndex >= 0 ? Number(args[topIndex + 1]) : 15));
}
