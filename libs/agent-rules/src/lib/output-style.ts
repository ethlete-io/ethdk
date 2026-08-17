import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { resolveContentRoot } from './load-content';

export const DEFAULT_OUTPUT_STYLE = 'ste-clarity';

const CONTENT_DIR = 'output-styles';

const MARKER_PREFIX = '<!-- @ethlete/agent-rules output style';

const marker = (name: string) =>
  `${MARKER_PREFIX} "${name}" — installed by \`ethlete-agents output-style\`. Re-run it to update; edits here are overwritten. -->`;

/** Claude Code reads `~/.claude`, or `CLAUDE_CONFIG_DIR` when it is set; an explicit path wins over both. */
export const resolveClaudeConfigDir = (override?: string) =>
  override?.trim() || process.env['CLAUDE_CONFIG_DIR']?.trim() || join(homedir(), '.claude');

export const availableOutputStyles = (contentRoot = resolveContentRoot()) => {
  const dir = join(contentRoot, CONTENT_DIR);

  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((entry) => entry.endsWith('.md'))
    .map((entry) => entry.slice(0, -'.md'.length))
    .sort();
};

const FRONTMATTER = /^(---\n[\s\S]*?\n---)\n?([\s\S]*)$/;

/**
 * The marker sits after the frontmatter, never before it: Claude Code only reads a style's `name`
 * and `description` when the file opens with the fence.
 */
const withMarker = (raw: string, name: string) => {
  const source = raw.replace(/\r\n/g, '\n').trim();
  const parts = FRONTMATTER.exec(source);

  if (!parts) return `${marker(name)}\n\n${source}\n`;

  return `${parts[1]}\n\n${marker(name)}\n\n${(parts[2] ?? '').trim()}\n`;
};

/**
 * Two files count as the same style when they hold the same text in any layout, so a copy that
 * predates the marker is still recognised as this command's own. Whitespace and the width of a
 * table's separator row are both layout: Prettier pads both, and neither changes what Claude reads.
 */
const normalize = (contents: string) =>
  contents
    .split('\n')
    .filter((line) => !line.startsWith(MARKER_PREFIX))
    .join(' ')
    .replace(/-{3,}/g, '---')
    .replace(/\s+/g, ' ')
    .trim();

const readShippedStyle = (name: string, contentRoot: string) => {
  const path = join(contentRoot, CONTENT_DIR, `${name}.md`);

  if (!existsSync(path)) {
    const known = availableOutputStyles(contentRoot);

    throw new Error(`Unknown output style "${name}". This package ships: ${known.join(', ') || 'none'}.`);
  }

  return readFileSync(path, 'utf8');
};

type SettingsFile = Record<string, unknown> & { outputStyle?: unknown };

const readSettings = (path: string) => {
  const raw = existsSync(path) ? readFileSync(path, 'utf8') : '';

  try {
    return JSON.parse(raw.trim() || '{}') as SettingsFile;
  } catch {
    throw new Error(`${path} is not valid JSON. Fix the file, then run this again.`);
  }
};

const withOutputStyle = (settings: SettingsFile, name: string | null) => {
  const next = { ...settings };

  if (name) next.outputStyle = name;
  else delete next.outputStyle;

  return `${JSON.stringify(next, null, 2)}\n`;
};

/** `contents` is `null` exactly when the action is `remove`. */
export type PlannedOutputStyleFile = { path: string; action: 'create' | 'update' | 'remove'; contents: string | null };

export type OutputStylePlan = {
  name: string;
  configDir: string;
  stylePath: string;
  settingsPath: string;
  /** The style Claude Code is set to now, before this plan is applied. */
  activeStyle: string | null;
  files: PlannedOutputStyleFile[];
  /** Set when the installed file is not this command's own; nothing is planned until `force`. */
  conflict: string | null;
};

export type OutputStyleOptions = {
  name?: string;
  configDir?: string;
  /** Also point `outputStyle` in `settings.json` at the style (default). */
  activate?: boolean;
  remove?: boolean;
  /** Overwrite or delete a style file this command did not write. */
  force?: boolean;
  contentRoot?: string;
};

/**
 * What an install (or a `remove`) would write into Claude Code's user config, without touching
 * disk. A style file that someone else wrote is reported as a conflict rather than overwritten -
 * the name is a plain file name, so a hand-written style can carry it.
 */
export const planOutputStyle = (options: OutputStyleOptions = {}): OutputStylePlan => {
  const name = options.name?.trim() || DEFAULT_OUTPUT_STYLE;
  const configDir = resolveClaudeConfigDir(options.configDir);
  const stylePath = join(configDir, CONTENT_DIR, `${name}.md`);
  const settingsPath = join(configDir, 'settings.json');
  const settings = readSettings(settingsPath);
  const activeStyle = typeof settings.outputStyle === 'string' ? settings.outputStyle : null;
  const installed = existsSync(stylePath) ? readFileSync(stylePath, 'utf8') : null;
  const shipped = withMarker(readShippedStyle(name, options.contentRoot ?? resolveContentRoot()), name);
  const ours = installed === null || installed.includes(MARKER_PREFIX) || normalize(installed) === normalize(shipped);
  const plan = { name, configDir, stylePath, settingsPath, activeStyle };

  if (!ours && !options.force) {
    const verb = options.remove ? 'delete' : 'overwrite';

    return {
      ...plan,
      files: [],
      conflict: `${stylePath} was not written by this command. Pass --force to ${verb} it, or rename your own style.`,
    };
  }

  const files: PlannedOutputStyleFile[] = [];
  const settingsAction = existsSync(settingsPath) ? 'update' : 'create';

  if (options.remove) {
    if (installed !== null) files.push({ path: stylePath, action: 'remove', contents: null });

    if (activeStyle === name) {
      files.push({ path: settingsPath, action: settingsAction, contents: withOutputStyle(settings, null) });
    }

    return { ...plan, files, conflict: null };
  }

  if (installed !== shipped) {
    files.push({ path: stylePath, action: installed === null ? 'create' : 'update', contents: shipped });
  }

  if (options.activate !== false && activeStyle !== name) {
    files.push({ path: settingsPath, action: settingsAction, contents: withOutputStyle(settings, name) });
  }

  return { ...plan, files, conflict: null };
};

export const applyOutputStylePlan = (plan: OutputStylePlan) => {
  for (const file of plan.files) {
    if (file.contents === null) {
      rmSync(file.path, { force: true });
      continue;
    }

    mkdirSync(dirname(file.path), { recursive: true });
    writeFileSync(file.path, file.contents, 'utf8');
  }
};
