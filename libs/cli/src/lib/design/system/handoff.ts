import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

export const HANDOFF_FILE = 'handoff.json';

/** A part that passed `design complete --handoff`, so app work may build it; CI re-checks it on every run. */
export type HandoffEntry = { at: string };

const handoffFileOf = (productDir: string) => resolve(productDir, HANDOFF_FILE);

export const readHandoff = (productDir: string): Record<string, HandoffEntry> => {
  const file = handoffFileOf(productDir);

  if (!existsSync(file)) return {};

  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? Object.fromEntries(
          Object.entries(parsed).filter(
            (entry): entry is [string, HandoffEntry] =>
              !!entry[1] && typeof entry[1] === 'object' && typeof (entry[1] as HandoffEntry).at === 'string',
          ),
        )
      : {};
  } catch {
    return {};
  }
};

export const recordHandoff = (options: { productDir: string; part: string; at?: string }) => {
  const entries = {
    ...readHandoff(options.productDir),
    [options.part]: { at: options.at ?? new Date().toISOString() },
  };
  const sorted = Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)));

  writeFileSync(handoffFileOf(options.productDir), `${JSON.stringify(sorted, null, 2)}\n`);
};
