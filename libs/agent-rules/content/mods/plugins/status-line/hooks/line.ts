const STALE_MS = 2 * 60 * 60 * 1000;
const QUEUE_HEADING = /^### Warteschlange(, Rest)?\s*$/;
const HEADING = /^#{1,6} /;
const QUEUE_ITEM = /^\d+\. \*\*(?:.+ \()?[A-Z]\d+b?\)?\*\*/;

export type StatusFields = {
  task?: string;
  minutes?: number;
  queue?: number;
  questions?: number;
  isCiRot?: boolean;
};

export const lastSlice = (content: string, mtimeMs: number) => {
  const blocks = content.split(/^(?=#\s*slice:)/m).filter((text) => /^#\s*slice:/m.test(text));
  const block = blocks.at(-1);
  if (block === undefined) return undefined;
  const name = /^#\s*slice:\s*(.+)$/m.exec(block)?.[1]?.trim();
  const written = /^#\s*written:\s*(\S+)/m.exec(block)?.[1];
  const writtenAt = written && !Number.isNaN(Date.parse(written)) ? Date.parse(written) : mtimeMs;
  return name ? { name, writtenAt } : undefined;
};

export const taskFields = (content: string, mtimeMs: number, nowMs: number): Pick<StatusFields, 'task' | 'minutes'> => {
  const slice = lastSlice(content, mtimeMs);
  if (slice === undefined) return {};
  if (nowMs - slice.writtenAt > STALE_MS) return { task: 'kein Slice' };
  return { task: slice.name, minutes: Math.max(0, Math.floor((nowMs - slice.writtenAt) / 60_000)) };
};

export const queueCount = (text: string) => {
  let count = 0;
  let isInQueue = false;
  for (const line of text.split('\n')) {
    if (HEADING.test(line)) isInQueue = QUEUE_HEADING.test(line);
    else if (isInQueue && QUEUE_ITEM.test(line)) count++;
  }
  return count;
};

export const questionCount = (text: string) => text.split('\n').filter((line) => line.startsWith('- ')).length;

export const planFilesOf = (configText: string) => {
  try {
    const files = (JSON.parse(configText) as { report?: { planFiles?: unknown } }).report?.planFiles;
    return Array.isArray(files) && files.every((f) => typeof f === 'string') ? (files as string[]) : undefined;
  } catch {
    return undefined;
  }
};

export const isCiRotOf = (runJson: string) => {
  try {
    const [run] = JSON.parse(runJson) as { conclusion?: string; status?: string }[];
    return run?.status === 'completed' && run.conclusion === 'failure';
  } catch {
    return false;
  }
};

const durationOf = (minutes: number) =>
  minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;

export const formatLine = (fields: StatusFields) => {
  const parts = [
    fields.task === undefined ? undefined : `▶ ${fields.task}`,
    fields.minutes === undefined ? undefined : durationOf(fields.minutes),
    fields.queue === undefined ? undefined : `${fields.queue} offen`,
    fields.questions ? `❓${fields.questions}` : undefined,
    fields.isCiRot ? '⛔ CI rot' : undefined,
  ].filter((part): part is string => part !== undefined);
  return parts.length === 0 ? null : parts.join(' · ');
};
