import { readFileSync } from 'fs';
import { ContentItem } from '../load-content';
import { buildBanner, LinkResolver, renderBody, renderDescription, substituteVars } from '../render';

export type EmittedFile = {
  /** Path relative to the consumer repo root, always with forward slashes. */
  path: string;
  contents: string;
};

export type EmitContext = {
  rules: ContentItem[];
  skills: ContentItem[];
  /** Names of the skills that actually survived filtering, so links can't point at a missing file. */
  emittedSkills: Set<string>;
  vars: Record<string, string | string[]>;
  version: string;
  /**
   * The repo's `CLAUDE.md` is an `@AGENTS.md` import (or symlink), so Claude already receives the
   * rules through the `AGENTS.md` marker block and must not get a second copy in `.claude/rules/`.
   */
  claudeMdImportsAgentsMd: boolean;
  /** Opt-in Claude Code hooks from the config. */
  hooks: string[];
};

export const AGENTS_SKILLS_DIR = '.agents/skills';

export const agentsSkillDir = (name: string) => `${AGENTS_SKILLS_DIR}/ethlete-${name}`;

export const agentsSkillPath = (name: string) => `${agentsSkillDir(name)}/SKILL.md`;

/**
 * A guide can be filtered out of a given repo while another still references it. Degrade such a
 * link to the bare name rather than emitting a path to a file that was never written.
 */
export const makeLinks = (options: {
  context: EmitContext;
  skill: (name: string) => string;
  resource: (target: { skillName: string; fileName: string }) => string;
}): LinkResolver => ({
  skill: (name) => (options.context.emittedSkills.has(name) ? options.skill(name) : `\`${name}\``),
  resource: options.resource,
});

export const agentsSkillsLinks = (context: EmitContext) =>
  makeLinks({
    context,
    skill: (name) => `\`${agentsSkillPath(name)}\``,
    resource: (target) => `\`${agentsSkillDir(target.skillName)}/${target.fileName}\``,
  });

export const body = (options: { item: ContentItem; context: EmitContext; links: LinkResolver }) =>
  renderBody({ item: options.item, vars: options.context.vars, links: options.links });

export const description = (options: { item: ContentItem; context: EmitContext }) =>
  renderDescription({ item: options.item, vars: options.context.vars });

export const resourceFiles = (options: {
  item: ContentItem;
  context: EmitContext;
  pathFor: (fileName: string) => string;
}) =>
  options.item.resources.map((resource) => ({
    path: options.pathFor(resource.fileName),
    contents: substituteVars({
      text: readFileSync(resource.absolutePath, 'utf8'),
      vars: options.context.vars,
      origin: `${options.item.frontmatter.name}/${resource.fileName}`,
    }),
  }));

/**
 * One skill in the agentskills.io layout: a `SKILL.md` with `name`/`description` frontmatter plus
 * its resource files as siblings. The same bundle serves `.claude/skills/` and `.agents/skills/`;
 * only the directory and the link resolver differ per target.
 */
export const skillBundle = (options: {
  item: ContentItem;
  context: EmitContext;
  dir: string;
  links: LinkResolver;
}): EmittedFile[] => {
  const { item, context, dir, links } = options;
  const frontmatter = [
    '---',
    `name: ethlete-${item.frontmatter.name}`,
    `description: ${yamlString(description({ item, context }))}`,
    '---',
  ].join('\n');

  return [
    {
      path: `${dir}/SKILL.md`,
      contents: document([frontmatter, buildBanner(context.version), body({ item, context, links })]),
    },
    ...resourceFiles({ item, context, pathFor: (fileName) => `${dir}/${fileName}` }),
  ];
};

/** Descriptions routinely contain `:` and `-`, so always quote them rather than guess. */
export const yamlString = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** Every generated document ends with exactly one trailing newline so Prettier stays quiet. */
export const document = (parts: string[]) => `${parts.filter((part) => part.length > 0).join('\n\n')}\n`;
