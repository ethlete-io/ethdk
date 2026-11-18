import { atom, update } from 'claude-code';
import type { EngineInterface, Register } from 'claude-code';

import { formatLine, isCiRotOf, planFilesOf, questionCount, queueCount, taskFields } from './line';
import type { StatusFields } from './line';

const TICK_MS = 5000;
const CI_EVERY_MS = 2 * 60_000;
const CI_TIMEOUT_MS = 15_000;
const line = atom({ plugin: 'status-line', key: 'line' } as const, null);

type Source = { mtimeMs: number; text: string };

const cache = new Map<string, Source | null>();

async function readChanged($: EngineInterface, path: string) {
  const stat = await $.fs.stat(path).catch(() => undefined);
  if (stat === undefined) {
    cache.delete(path);
    return null;
  }
  const cached = cache.get(path);
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached;
  const text = await $.fs.read(path).catch(() => undefined);
  if (text === undefined) return null;
  const source = { mtimeMs: stat.mtimeMs, text };
  cache.set(path, source);
  return source;
}

async function git($: EngineInterface, args: string[]) {
  const result = await $.process.run(['git', ...args], { timeoutMs: 5000 }).catch(() => undefined);
  return result?.exitCode === 0 ? result.stdout.trim() : undefined;
}

let isCiRot = false;
let lastCiMs = 0;
let isCiRunning = false;

async function refreshCi($: EngineInterface, nowMs: number) {
  if (isCiRunning || nowMs - lastCiMs < CI_EVERY_MS) return;
  isCiRunning = true;
  lastCiMs = nowMs;
  try {
    const branch = await git($, ['branch', '--show-current']);
    const result = branch
      ? await $.process.run(['gh', 'run', 'list', '--branch', branch, '-L', '1', '--json', 'conclusion,status'], {
          timeoutMs: CI_TIMEOUT_MS,
        })
      : undefined;
    isCiRot = result?.exitCode === 0 && isCiRotOf(result.stdout);
  } catch {
    isCiRot = false;
  } finally {
    isCiRunning = false;
  }
}

async function compute($: EngineInterface, nowMs: number): Promise<StatusFields> {
  const paths = await git($, [
    'rev-parse',
    '--path-format=absolute',
    '--git-path',
    'slice-paths',
    '--git-common-dir',
    '--show-toplevel',
  ]);
  const [slicePath, commonDir, root] = paths?.split('\n') ?? [];
  const fields: StatusFields = {};

  if (slicePath) {
    const slice = await readChanged($, slicePath);
    if (slice) Object.assign(fields, taskFields(slice.text, slice.mtimeMs, nowMs));
  }

  if (root) {
    const config = await readChanged($, `${root}/ethlete-agents.config.json`);
    const planFiles = config ? planFilesOf(config.text) : undefined;
    if (planFiles) {
      const texts = await Promise.all(planFiles.map((file) => readChanged($, `${root}/${file}`)));
      fields.queue = texts.reduce((sum, source) => sum + (source ? queueCount(source.text) : 0), 0);
    }
  }

  if (commonDir) {
    const questions = await readChanged($, `${commonDir}/ethlete/open-questions.md`);
    if (questions) fields.questions = questionCount(questions.text);
  }

  fields.isCiRot = isCiRot;
  return fields;
}

async function tick($: EngineInterface) {
  try {
    const nowMs = await $.clock.now();
    void refreshCi($, nowMs);
    const text = formatLine(await compute($, nowMs));
    await update($, line, () => text);
  } catch {
    await update($, line, () => null).catch(() => undefined);
  }
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    $.clock.every(TICK_MS, () => tick($));
    await tick($);
    return next(e);
  });

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const text = (await $.state.get({ plugin: 'status-line', key: 'line' } as const)).value;
    if (!text) return next(e);
    const { Box, Text } = $.ui.resolve(e);
    return (
      <Box>
        <Text dimColor>{text}</Text>
      </Box>
    );
  });
};
