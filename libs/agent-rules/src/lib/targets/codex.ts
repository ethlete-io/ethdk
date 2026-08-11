import { BANNER, replaceMarkedBlock } from '../render';
import { agentsSkillsLinks, body, document, EmitContext, EmittedFile } from './shared';

export const CODEX_FILE = 'AGENTS.md';

/**
 * The always-loaded rules are inlined into the `AGENTS.md` marker block — layered `AGENTS.md`
 * files are Codex's rules mechanism. Skills are emitted as real skills under `.agents/skills/`
 * (see `emitAgentsSkills`) and self-describe through their frontmatter, so the block carries only
 * a two-line hint instead of repeating every description into each session's context. Everything
 * outside the marker block is left as the repo wrote it.
 */
export const emitCodex = (options: { context: EmitContext; existing: string }): EmittedFile[] => {
  const { context, existing } = options;
  const sections = context.rules.map((item) => body({ item, context, links: agentsSkillsLinks(context) }));

  if (context.skills.length > 0) {
    sections.push(
      [
        '## Ethlete skills',
        "On-demand guides live in `.agents/skills/ethlete-*/SKILL.md`; each one's frontmatter says when to read it. If your agent does not discover skills on its own, list that directory and read the matching guide before starting that kind of work — do not work from memory.",
      ].join('\n\n'),
    );
  }

  const block = document([BANNER, ...sections]).trimEnd();

  return [{ path: CODEX_FILE, contents: replaceMarkedBlock({ existing, block }) }];
};
