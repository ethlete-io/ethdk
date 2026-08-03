import { buildBanner, replaceMarkedBlock } from '../render';
import { agentsSkillsLinks, body, document, EmitContext, EmittedFile } from './shared';

export const COPILOT_FILE = '.github/copilot-instructions.md';

/**
 * Always-loaded rules go into the `copilot-instructions.md` marker block. Skills are not mirrored
 * here — Copilot discovers `.agents/skills/` natively, so the old pointer table and the
 * `applyTo`-scoped `.instructions.md` fallback are gone.
 */
export const emitCopilot = (options: { context: EmitContext; existing: string }): EmittedFile[] => {
  const { context, existing } = options;
  const banner = buildBanner(context.version);
  const sections = context.rules.map((item) => body({ item, context, links: agentsSkillsLinks(context) }));
  const block = document([banner, ...sections]).trimEnd();

  return [{ path: COPILOT_FILE, contents: replaceMarkedBlock({ existing, block }) }];
};
