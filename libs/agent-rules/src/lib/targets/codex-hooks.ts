import { EmitContext, EmittedFile } from './shared';
import { emitHookScripts, emitHookSettings } from './hooks-shared';

export const CODEX_HOOKS_FILE = '.codex/hooks.json';

const HOOKS_DIR = '.codex/hooks/ethlete';

/**
 * Codex exposes no project-dir variable, so the path is resolved the way Codex's own hook docs
 * resolve it — the command string is evaluated by a shell.
 */
const commandFor = (file: string) => `python3 "$(git rev-parse --show-toplevel)/${HOOKS_DIR}/${file}" --agent codex`;

/**
 * The hook scripts plus the `.codex/hooks.json` registration. Runs even when the codex target is
 * off so a repo that drops the target also gets its stale registrations removed — but an absent
 * file stays absent rather than being created empty.
 */
export const emitCodexHooks = (options: {
  context: EmitContext;
  codexTarget: boolean;
  existingHooks: string;
}): EmittedFile[] => {
  const { context, codexTarget, existingHooks } = options;
  const hooks = codexTarget ? context.hooks : [];

  return [
    ...emitHookScripts({ hooks, hooksDir: HOOKS_DIR, version: context.version }),
    ...emitHookSettings({
      path: CODEX_HOOKS_FILE,
      existing: existingHooks,
      hooks,
      hooksDir: HOOKS_DIR,
      commandFor,
      createWhenEmpty: false,
    }),
  ];
};
