import { buildBanner } from '../render';
import { body, document, EmitContext, EmittedFile, makeLinks, skillBundle } from './shared';

const skillDir = (name: string) => `.claude/skills/ethlete-${name}`;

const quoteList = (values: string[]) => values.map((value) => `  - '${value}'`).join('\n');

/**
 * Rules land in `.claude/rules/ethlete/` (loaded every session, or only for matching files when
 * the content declares `paths`); skills land in `.claude/skills/` under an `ethlete-` prefix so a
 * generated skill can never collide with one the repo wrote itself. When the repo's `CLAUDE.md`
 * imports `AGENTS.md`, the rules already reach Claude through the `AGENTS.md` marker block, so the
 * rules directory is skipped entirely rather than loading everything twice.
 */
export const emitClaude = (context: EmitContext): EmittedFile[] => {
  const banner = buildBanner(context.version);
  const links = makeLinks({
    context,
    skill: (name) => `the **\`ethlete-${name}\`** skill`,
    resource: (target) => `\`${target.fileName}\` (bundled next to this skill)`,
  });
  const files: EmittedFile[] = [];

  if (!context.claudeMdImportsAgentsMd) {
    for (const item of context.rules) {
      const { name, paths } = item.frontmatter;
      const frontmatter = paths.length > 0 ? `---\npaths:\n${quoteList(paths)}\n---` : '';

      files.push({
        path: `.claude/rules/ethlete/${name}.md`,
        contents: document([frontmatter, banner, body({ item, context, links })]),
      });
    }
  }

  for (const item of context.skills) {
    files.push(...skillBundle({ item, context, dir: skillDir(item.frontmatter.name), links }));
  }

  return files;
};
