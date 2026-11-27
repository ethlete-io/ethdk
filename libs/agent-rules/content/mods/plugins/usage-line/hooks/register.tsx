import { atom, update } from 'claude-code';
import type { EngineInterface, Register } from 'claude-code';

import { latestCodexSample, formatCodex } from './codex';
import type { CodexSample } from './codex';
import { formatUsage, statusTextOf } from './format';

const usage = atom({ plugin: 'usage-line', key: 'usage' } as const, null);

const CODEX_ROOT = '.codex/sessions';
const CODEX_REFRESH_MS = 30_000;
const CODEX_SCAN_FILES = 3;

let codexSample: CodexSample | undefined;
let codexCheckedAt = 0;

async function newestDirectory($: EngineInterface, path: string) {
  const entries = await $.fs.list(path).catch(() => []);
  return entries.filter((entry) => entry.kind === 'dir').sort((a, b) => b.name.localeCompare(a.name));
}

async function newestRollouts($: EngineInterface, root: string) {
  for (const year of await newestDirectory($, root)) {
    for (const month of await newestDirectory($, `${root}/${year.name}`)) {
      for (const day of await newestDirectory($, `${root}/${year.name}/${month.name}`)) {
        const dir = `${root}/${year.name}/${month.name}/${day.name}`;
        const files = (await $.fs.list(dir).catch(() => [])).filter((entry) => entry.name.endsWith('.jsonl'));
        if (files.length > 0) {
          return files
            .sort((a, b) => b.mtimeMs - a.mtimeMs)
            .slice(0, CODEX_SCAN_FILES)
            .map((f) => `${dir}/${f.name}`);
        }
      }
    }
  }
  return [];
}

async function refreshCodex($: EngineInterface, now: number) {
  if (now - codexCheckedAt < CODEX_REFRESH_MS) return;
  codexCheckedAt = now;
  const home = await $.env.get('HOME');
  if (!home) return;
  let latest: CodexSample | undefined;
  for (const path of await newestRollouts($, `${home}/${CODEX_ROOT}`)) {
    const sample = latestCodexSample(await $.fs.read(path).catch(() => ''));
    if (sample && (!latest || sample.at >= latest.at)) latest = sample;
  }
  codexSample = latest ?? codexSample;
}

export const register: Register = (on) => {
  on('session.measure', async ($, e, next) => {
    const now = await $.clock.now();
    await refreshCodex($, now).catch(() => undefined);
    const parts = [formatUsage(e.rateLimits), formatCodex(codexSample, now)].filter(Boolean);
    const text = parts.length > 0 ? parts.join(' · ') : null;
    await update($, usage, () => text).catch(() => undefined);
    return next(e);
  });

  on('ui.render', { component: 'StatusLine' }, async ($, e, next) => {
    const text = (await $.state.get({ plugin: 'usage-line', key: 'usage' } as const)).value;
    return next({ ...e, props: { ...e.props, text: statusTextOf(e.props.text, text ?? null) } });
  });
};
