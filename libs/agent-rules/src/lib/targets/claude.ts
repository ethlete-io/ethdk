import { LinkResolver, buildBanner } from '../render';
import { body, description, document, EmitContext, EmittedFile, resourceFiles, yamlString } from './shared';

const skillDir = (name: string) => `.claude/skills/ethlete-${name}`;

const links: LinkResolver = {
  skill: (name) => `the **\`ethlete-${name}\`** skill`,
  resource: (options) => `\`${options.fileName}\` (bundled next to this skill)`,
};

const quoteList = (values: string[]) => values.map((value) => `  - '${value}'`).join('\n');

/**
 * Rules land in `.claude/rules/ethlete/` (loaded every session, or only for matching files when
 * the content declares `paths`); skills land in `.claude/skills/` under an `ethlete-` prefix so a
 * generated skill can never collide with one the repo wrote itself.
 */
export const emitClaude = (context: EmitContext): EmittedFile[] => {
  const banner = buildBanner(context.version);
  const files: EmittedFile[] = [];

  for (const item of context.rules) {
    const { name, paths } = item.frontmatter;
    const frontmatter = paths.length > 0 ? `---\npaths:\n${quoteList(paths)}\n---` : '';

    files.push({
      path: `.claude/rules/ethlete/${name}.md`,
      contents: document([frontmatter, banner, body({ item, context, links })]),
    });
  }

  for (const item of context.skills) {
    const { name } = item.frontmatter;
    const frontmatter = [
      '---',
      `name: ethlete-${name}`,
      `description: ${yamlString(description({ item, context }))}`,
      '---',
    ].join('\n');

    files.push({
      path: `${skillDir(name)}/SKILL.md`,
      contents: document([frontmatter, banner, body({ item, context, links })]),
    });

    files.push(...resourceFiles({ item, context, pathFor: (fileName) => `${skillDir(name)}/${fileName}` }));
  }

  return files;
};
