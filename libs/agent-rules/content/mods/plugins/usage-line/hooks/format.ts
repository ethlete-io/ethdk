type RateLimit = { kind: string; percentUsed: number; resetsAt?: string };

const pad = (value: number) => String(value).padStart(2, '0');

function clock(iso: string | undefined) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return ` bis ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const percent = (limit: RateLimit | undefined) => (limit ? String(limit.percentUsed) : '?');

export function formatUsage(limits: RateLimit[]) {
  const fiveHour = limits.find((limit) => limit.kind === 'five_hour');
  const sevenDay = limits.find((limit) => limit.kind === 'seven_day');
  if (!fiveHour && !sevenDay) return undefined;
  return `5h ${percent(fiveHour)}%${clock(fiveHour?.resetsAt)} · Woche ${percent(sevenDay)}%`;
}
