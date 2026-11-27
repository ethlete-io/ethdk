type Window = { used_percent: number; resets_at: number };
export type CodexSample = { at: number; primary: Window; secondary?: Window };

const pad = (value: number) => String(value).padStart(2, '0');

export function parseCodexLine(line: string): CodexSample | undefined {
  if (!line.includes('"rate_limits"')) return undefined;
  try {
    const event = JSON.parse(line);
    const limits = event?.payload?.rate_limits;
    const at = Date.parse(event.timestamp);
    if (!limits?.primary || limits.limit_id !== 'codex' || Number.isNaN(at)) return undefined;
    return { at, primary: limits.primary, secondary: limits.secondary };
  } catch {
    return undefined;
  }
}

export function latestCodexSample(text: string) {
  let latest: CodexSample | undefined;
  for (const line of text.split('\n')) {
    const sample = parseCodexLine(line);
    if (sample && (!latest || sample.at >= latest.at)) latest = sample;
  }
  return latest;
}

function windowOf(window: Window | undefined, now: number) {
  if (!window) return undefined;
  const resetsAt = window.resets_at * 1000;
  const used = resetsAt <= now ? 0 : window.used_percent;
  return { left: Math.max(0, Math.round(100 - used)), resetsAt, exhausted: used >= 100 };
}

function clock(ms: number, now: number) {
  const date = new Date(ms);
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return date.toDateString() === new Date(now).toDateString()
    ? time
    : `${pad(date.getDate())}.${pad(date.getMonth() + 1)}. ${time}`;
}

export function formatCodex(sample: CodexSample | undefined, now: number) {
  if (!sample) return undefined;
  const fiveHour = windowOf(sample.primary, now);
  const week = windowOf(sample.secondary, now);
  if (!fiveHour) return undefined;
  const mark = fiveHour.exhausted || week?.exhausted ? '⛔ ' : '';
  const reset = fiveHour.exhausted ? ` (${clock(fiveHour.resetsAt, now)})` : '';
  const weekText = week ? ` · wk ${week.left}%${week.exhausted ? ` (${clock(week.resetsAt, now)})` : ''}` : '';
  return `${mark}codex 5h ${fiveHour.left}%${reset}${weekText}`;
}
