import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { Frontmatter, parseFrontmatter } from './frontmatter';

export type ContentResource = {
  /** File name as referenced from a body via `{{resource:…}}`. */
  fileName: string;
  absolutePath: string;
};

export type ContentItem = {
  frontmatter: Frontmatter;
  body: string;
  sourcePath: string;
  resources: ContentResource[];
};

/**
 * The compiled CLI lives at `<pkg>/src/lib/`, the shipped markdown at `<pkg>/content/`.
 * The same relative hop works from the TypeScript sources, so dev and published runs agree.
 */
export const resolveContentRoot = () => join(__dirname, '..', '..', 'content');

const readMarkdown = (path: string) => readFileSync(path, 'utf8');

const loadRules = (contentRoot: string) => {
  const dir = join(contentRoot, 'rules');

  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((entry) => entry.endsWith('.md'))
    .sort()
    .map((entry) => {
      const sourcePath = join(dir, entry);
      const { frontmatter, body } = parseFrontmatter(readMarkdown(sourcePath), `rules/${entry}`);

      if (frontmatter.kind !== 'rule') {
        throw new Error(`rules/${entry}: kind must be "rule" for a file under content/rules.`);
      }

      return { frontmatter, body, sourcePath, resources: [] };
    });
};

const loadSkills = (contentRoot: string) => {
  const dir = join(contentRoot, 'skills');

  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((entry) => statSync(join(dir, entry)).isDirectory())
    .sort()
    .map((entry) => {
      const skillDir = join(dir, entry);
      const sourcePath = join(skillDir, 'SKILL.md');

      if (!existsSync(sourcePath)) {
        throw new Error(`skills/${entry}: directory has no SKILL.md.`);
      }

      const { frontmatter, body } = parseFrontmatter(readMarkdown(sourcePath), `skills/${entry}/SKILL.md`);

      if (frontmatter.kind !== 'skill') {
        throw new Error(`skills/${entry}/SKILL.md: kind must be "skill" for a file under content/skills.`);
      }

      if (frontmatter.name !== entry) {
        throw new Error(`skills/${entry}/SKILL.md: frontmatter name "${frontmatter.name}" must match the folder.`);
      }

      const resources = readdirSync(skillDir)
        .filter((file) => file !== 'SKILL.md' && statSync(join(skillDir, file)).isFile())
        .sort()
        .map((file) => ({ fileName: file, absolutePath: join(skillDir, file) }));

      return { frontmatter, body, sourcePath, resources };
    });
};

export const loadContent = (contentRoot = resolveContentRoot()): ContentItem[] => {
  if (!existsSync(contentRoot)) {
    throw new Error(`Content directory not found at ${contentRoot}. The package build may be missing its assets.`);
  }

  const items = [...loadRules(contentRoot), ...loadSkills(contentRoot)];
  const seen = new Set<string>();

  for (const item of items) {
    if (seen.has(item.frontmatter.name)) {
      throw new Error(
        `Duplicate content name "${item.frontmatter.name}" — names must be unique across rules and skills.`,
      );
    }

    seen.add(item.frontmatter.name);
  }

  return items;
};

export const loadDefaultVars = (contentRoot = resolveContentRoot()): Record<string, string | string[]> => {
  const path = join(contentRoot, 'defaults.json');

  if (!existsSync(path)) return {};

  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, string | string[]>;
};
