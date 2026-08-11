import { EmitContext, EmittedFile } from './shared';
import { emitHookScripts, emitHookSettings } from './hooks-shared';

export const CLAUDE_SETTINGS_FILE = '.claude/settings.json';

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
}): EmittedFile[] => {
  const { context, claudeTarget, existingSettings } = options;
  const hooks = claudeTarget ? context.hooks : [];

  return [
    ...emitHookScripts({ hooks, hooksDir: HOOKS_DIR }),
    ...emitHookSettings({
      path: CLAUDE_SETTINGS_FILE,
      existing: existingSettings,
      hooks,
      hooksDir: HOOKS_DIR,
      commandFor,
      createWhenEmpty: true,
    }),
  ];
};
