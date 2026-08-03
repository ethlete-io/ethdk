import { buildBanner } from '../render';
import { agentsSkillsLinks, body, description, document, EmitContext, EmittedFile, yamlString } from './shared';

/**
 * Always-loaded rules become `alwaysApply` `.mdc` files (path-scoped ones via `globs`). Skills are
 * not mirrored here — Cursor discovers them from `.agents/skills/` like every other
 * agentskills.io-aware tool.
 */
export const emitCursor = (context: EmitContext): EmittedFile[] => {
  const banner = buildBanner(context.version);
  const links = agentsSkillsLinks(context);

  return context.rules.map((item) => {
    const { name, paths } = item.frontmatter;
    const frontmatter = [
      '---',
      `description: ${yamlString(description({ item, context }))}`,
      paths.length > 0 ? `globs: ${paths.join(',')}` : 'globs:',
      'alwaysApply: true',
      '---',
    ].join('\n');

    return {
      path: `.cursor/rules/ethlete-${name}.mdc`,
      contents: document([frontmatter, banner, body({ item, context, links })]),
    };
  });
};
