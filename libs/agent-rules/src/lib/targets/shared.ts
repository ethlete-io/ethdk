import { readFileSync } from 'fs';
import { ContentItem } from '../load-content';
import { LinkResolver, renderBody, renderDescription, substituteVars } from '../render';

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
};

export const NEUTRAL_DIR = '.agents/ethlete';

export const neutralBodyPath = (name: string) => `${NEUTRAL_DIR}/${name}.md`;

export const neutralResourcePath = (options: { skillName: string; fileName: string }) =>
  `${NEUTRAL_DIR}/${options.skillName}/${options.fileName}`;

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

export const neutralLinks = (context: EmitContext) =>
  makeLinks({
    context,
    skill: (name) => `\`${neutralBodyPath(name)}\``,
    resource: (target) => `\`${neutralResourcePath(target)}\``,
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

/** Descriptions routinely contain `:` and `-`, so always quote them rather than guess. */
export const yamlString = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** Every generated document ends with exactly one trailing newline so Prettier stays quiet. */
export const document = (parts: string[]) => `${parts.filter((part) => part.length > 0).join('\n\n')}\n`;

export const pointerTable = (options: {
  skills: ContentItem[];
  context: EmitContext;
  pathFor: (name: string) => string;
}) => {
  const rows = options.skills.map(
    (item) => `| \`${options.pathFor(item.frontmatter.name)}\` | ${description({ item, context: options.context })} |`,
  );

  return ['| Read this file | When |', '| --- | --- |', ...rows].join('\n');
};
