import { EmitContext, EmittedFile } from './shared';
import { packageRunnerVar } from '../render';
import { mergeModSettings, modMarketplacePath } from './claude-mods';
import { emitHookScripts, emitHookSettings, hooksForAgent } from './hooks-shared';

export const CLAUDE_SETTINGS_FILE = '.claude/settings.json';
export const CLAUDE_LOCAL_SETTINGS_FILE = '.claude/settings.local.json';

const HOOKS_DIR = '.claude/hooks/ethlete';

const commandFor = (file: string) => `python3 "$CLAUDE_PROJECT_DIR/${HOOKS_DIR}/${file}" --agent claude`;

/**
 * The hook scripts plus the settings registration. Runs even when the claude target is off so a
 * repo that drops the target also gets its stale registrations removed.
 */
export const emitClaudeHooks = (options: {
  context: EmitContext;
  claudeTarget: boolean;
  existingSettings: string;
  mods: string[];
  existingLocalSettings: string;
  localMods: string[];
  sdkProfile: boolean;
}): EmittedFile[] => {
  const { context, claudeTarget, existingSettings, existingLocalSettings, sdkProfile } = options;
  const hooks = claudeTarget ? hooksForAgent({ hooks: context.hooks, agent: 'claude' }) : [];
  const mods = claudeTarget ? options.mods : [];
  const localMods = claudeTarget ? options.localMods : [];
  const marketplacePath = modMarketplacePath({ sdkProfile });

  return [
    ...emitHookScripts({ hooks, hooksDir: HOOKS_DIR, runner: packageRunnerVar(context.vars) }),
    ...emitHookSettings({
      agent: 'claude',
      path: CLAUDE_SETTINGS_FILE,
      existing: existingSettings,
      hooks,
      hooksDir: HOOKS_DIR,
      commandFor,
      createWhenEmpty: true,
      mergeExtra: (merged) => mergeModSettings({ existing: merged, mods, marketplacePath }),
    }),
    ...emitLocalModSettings({ existing: existingLocalSettings, mods: localMods, marketplacePath }),
  ];
};

const emitLocalModSettings = (options: {
  existing: string;
  mods: string[];
  marketplacePath: string;
}): EmittedFile[] => {
  const { existing, mods, marketplacePath } = options;

  if (existing.trim().length === 0 && mods.length === 0) return [];

  try {
    const merged = mergeModSettings({ existing, mods, marketplacePath });

    if (JSON.stringify(JSON.parse(existing.trim() || '{}')) === JSON.stringify(JSON.parse(merged))) return [];

    return [{ path: CLAUDE_LOCAL_SETTINGS_FILE, contents: merged }];
  } catch {
    return [];
  }
};
