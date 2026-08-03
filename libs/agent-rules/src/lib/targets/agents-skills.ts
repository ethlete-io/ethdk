import { agentsSkillDir, agentsSkillsLinks, EmitContext, EmittedFile, skillBundle } from './shared';

/**
 * Skills in the agentskills.io standard layout under `.agents/skills/`, discovered natively by
 * Codex, Cursor, Copilot and VS Code — each tool loads a skill's body on demand from its
 * `description` frontmatter. Claude Code only scans `.claude/skills/`, so the claude target emits
 * its own copies there.
 */
export const emitAgentsSkills = (context: EmitContext): EmittedFile[] =>
  context.skills.flatMap((item) =>
    skillBundle({
      item,
      context,
      dir: agentsSkillDir(item.frontmatter.name),
      links: agentsSkillsLinks(context),
    }),
  );
