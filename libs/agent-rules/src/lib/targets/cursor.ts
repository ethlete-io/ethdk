import { LinkResolver, buildBanner } from '../render';
import { body, description, document, EmitContext, EmittedFile, neutralResourcePath, yamlString } from './shared';

const links: LinkResolver = {
  skill: (name) => `the **\`ethlete-${name}\`** rule`,
  resource: (options) => `\`${neutralResourcePath(options)}\``,
};

/**
 * Cursor has no bundle concept, so a skill's resource files stay in the neutral `.agents/ethlete/`
 * tree and the rule points at them. Rules apply always; skills are "agent requested" — Cursor picks
 * them from the description, or attaches them automatically when `globs` match the open file.
 */
export const emitCursor = (context: EmitContext): EmittedFile[] => {
  const banner = buildBanner(context.version);

  const emit = (options: { items: typeof context.rules; alwaysApply: boolean }) =>
    options.items.map((item) => {
      const { name, paths } = item.frontmatter;
      const frontmatter = [
        '---',
        `description: ${yamlString(description({ item, context }))}`,
        paths.length > 0 ? `globs: ${paths.join(',')}` : 'globs:',
        `alwaysApply: ${options.alwaysApply}`,
        '---',
      ].join('\n');

      return {
        path: `.cursor/rules/ethlete-${name}.mdc`,
        contents: document([frontmatter, banner, body({ item, context, links })]),
      };
    });

  return [...emit({ items: context.rules, alwaysApply: true }), ...emit({ items: context.skills, alwaysApply: false })];
};
