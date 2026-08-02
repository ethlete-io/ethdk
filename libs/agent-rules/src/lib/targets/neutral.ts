import { buildBanner } from '../render';
import {
  body,
  document,
  EmitContext,
  EmittedFile,
  neutralBodyPath,
  neutralLinks,
  neutralResourcePath,
  resourceFiles,
} from './shared';

/**
 * Plain markdown copies under `.agents/ethlete/`, with no agent-specific frontmatter. Codex,
 * Cursor and Copilot all point at these for anything their own format cannot express — Codex has
 * no on-demand mechanism at all, and neither Cursor nor Copilot can bundle a resource file
 * alongside a rule.
 */
export const emitNeutral = (context: EmitContext): EmittedFile[] => {
  const banner = buildBanner(context.version);
  const files: EmittedFile[] = [];

  for (const item of context.skills) {
    files.push({
      path: neutralBodyPath(item.frontmatter.name),
      contents: document([banner, body({ item, context, links: neutralLinks(context) })]),
    });

    files.push(
      ...resourceFiles({
        item,
        context,
        pathFor: (fileName) => neutralResourcePath({ skillName: item.frontmatter.name, fileName }),
      }),
    );
  }

  return files;
};
