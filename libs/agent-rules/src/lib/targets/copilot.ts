import { LinkResolver, buildBanner, replaceMarkedBlock } from '../render';
import {
  body,
  document,
  EmitContext,
  EmittedFile,
  neutralBodyPath,
  neutralResourcePath,
  pointerTable,
  yamlString,
} from './shared';

export const COPILOT_FILE = '.github/copilot-instructions.md';

const links: LinkResolver = {
  skill: (name) => `\`${neutralBodyPath(name)}\``,
  resource: (options) => `\`${neutralResourcePath(options)}\``,
};

/**
 * Copilot can scope an instruction file to a glob but has no way to load one on description alone,
 * so a skill with `paths` becomes a real `.instructions.md` and everything else falls back to a
 * manifest pointer in the always-loaded file.
 */
export const emitCopilot = (options: { context: EmitContext; existing: string }): EmittedFile[] => {
  const { context, existing } = options;
  const banner = buildBanner(context.version);
  const files: EmittedFile[] = [];

  const scoped = context.skills.filter((item) => item.frontmatter.paths.length > 0);
  const unscoped = context.skills.filter((item) => item.frontmatter.paths.length === 0);

  for (const item of scoped) {
    const frontmatter = ['---', `applyTo: ${yamlString(item.frontmatter.paths.join(','))}`, '---'].join('\n');

    files.push({
      path: `.github/instructions/ethlete-${item.frontmatter.name}.instructions.md`,
      contents: document([frontmatter, banner, body({ item, context, links })]),
    });
  }

  const sections = context.rules.map((item) => body({ item, context, links }));

  if (unscoped.length > 0) {
    sections.push(
      [
        '## Ethlete reference docs',
        'Read the matching file before starting that kind of work — do not work from memory.',
        pointerTable({ skills: unscoped, context, pathFor: neutralBodyPath }),
      ].join('\n\n'),
    );
  }

  const block = document([banner, ...sections]).trimEnd();

  files.push({ path: COPILOT_FILE, contents: replaceMarkedBlock({ existing, block }) });

  return files;
};
