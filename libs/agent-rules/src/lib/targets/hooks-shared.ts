import { readFileSync } from 'fs';
import { join } from 'path';
import { resolveContentRoot } from '../load-content';
import { SHELL_BANNER } from '../render';
import { EmittedFile } from './shared';

type HookDefinition = { event: string; file: string; timeout: number };

/**
 * Hooks a repo can opt into via the config's `hooks` array. Hooks run arbitrary commands on the
 * developer's machine, so unlike rules and skills they are never emitted by default.
 */
export const KNOWN_HOOKS: Record<string, HookDefinition> = {
  'context-warning': { event: 'UserPromptSubmit', file: 'context-warning.py', timeout: 10 },
};

export const assertKnownHooks = (hooks: string[]) => {
  const unknown = hooks.filter((name) => !(name in KNOWN_HOOKS));

  if (unknown.length > 0) {
    throw new Error(`Unknown hook(s): ${unknown.join(', ')}. Known hooks: ${Object.keys(KNOWN_HOOKS).join(', ')}.`);
  }
};

/** Placed after the shebang so the file stays runnable. */
const withBanner = (raw: string) => {
  const lines = raw.split('\n');

  if (lines[0]?.startsWith('#!')) return [lines[0], SHELL_BANNER, ...lines.slice(1)].join('\n');

  return `${SHELL_BANNER}\n${raw}`;
};

type HookCommand = { type?: string; command?: string; timeout?: number };
type HookGroup = { hooks?: HookCommand[] };
type HookSettings = Record<string, unknown> & { hooks?: Record<string, HookGroup[]> };

/**
 * Rewrites the generated entries declaratively: every entry whose command points into the
 * agent's `hooks/ethlete/` directory is dropped and the currently enabled hooks are re-added, so
 * disabling a hook in the config also unregisters it. Everything else in the file is untouched.
 */
export const mergeHookSettings = (options: {
  existing: string;
  hooks: string[];
  hooksDir: string;
  commandFor: (file: string) => string;
}) => {
  const { existing, hooks, hooksDir, commandFor } = options;
  const settings = JSON.parse(existing.trim() || '{}') as HookSettings;
  const events = { ...(settings.hooks ?? {}) };

  for (const [event, groups] of Object.entries(events)) {
    const kept = groups
      .map((group) => ({
        ...group,
        hooks: (group.hooks ?? []).filter((hook) => !(hook.command ?? '').includes(hooksDir)),
      }))
      .filter((group) => group.hooks.length > 0);

    if (kept.length > 0) events[event] = kept;
    else delete events[event];
  }

  for (const name of hooks) {
    const definition = KNOWN_HOOKS[name];

    if (!definition) continue;

    events[definition.event] = [
      ...(events[definition.event] ?? []),
      { hooks: [{ type: 'command', command: commandFor(definition.file), timeout: definition.timeout }] },
    ];
  }

  if (Object.keys(events).length > 0) settings.hooks = events;
  else delete settings.hooks;

  return `${JSON.stringify(settings, null, 2)}\n`;
};

export const emitHookScripts = (options: { hooks: string[]; hooksDir: string }): EmittedFile[] => {
  const { hooks, hooksDir } = options;

  return hooks.flatMap((name) => {
    const definition = KNOWN_HOOKS[name];

    if (!definition) return [];

    const raw = readFileSync(join(resolveContentRoot(), 'hooks', definition.file), 'utf8');

    return [{ path: `${hooksDir}/${definition.file}`, contents: withBanner(raw) }];
  });
};

/** Only planned when the parsed content actually changes; an unparseable file is left alone. */
export const emitHookSettings = (options: {
  path: string;
  existing: string;
  hooks: string[];
  hooksDir: string;
  commandFor: (file: string) => string;
  createWhenEmpty: boolean;
}): EmittedFile[] => {
  const { path, existing, hooks, hooksDir, commandFor, createWhenEmpty } = options;

  if (existing.trim().length === 0 && hooks.length === 0 && !createWhenEmpty) return [];

  try {
    const merged = mergeHookSettings({ existing, hooks, hooksDir, commandFor });

    if (JSON.stringify(JSON.parse(existing.trim() || '{}')) === JSON.stringify(JSON.parse(merged))) return [];

    return [{ path, contents: merged }];
  } catch {
    return [];
  }
};
