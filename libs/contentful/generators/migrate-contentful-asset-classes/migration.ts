import { formatFiles, Tree } from '@nx/devkit';
import { createMigrationScope, MigrationScopeOptions } from '../migrate-to-contentful-v5/migration-scope.js';

export const CONTENTFUL_ASSET_CLASSES_REPORT_PATH = 'contentful-asset-classes-migration-tasks.md';

const REMOVED_CLASS_INPUTS: Record<string, Record<string, string>> = {
  'et-contentful-video': { videoClass: 'et-contentful-video-video' },
  'et-contentful-audio': {
    audioClass: 'et-contentful-audio-audio',
    figureClass: 'et-contentful-audio-figure',
    figcaptionClass: 'et-contentful-audio-figcaption',
  },
  'et-contentful-file': { fileClass: 'et-contentful-file-anchor' },
  'et-contentful-link': { textClass: 'et-contentful-link-anchor', anchorClass: 'et-contentful-link-anchor' },
};

const TAG_REGEX = new RegExp(`<(${Object.keys(REMOVED_CLASS_INPUTS).join('|')})(?=[\\s/>])`, 'g');
const INLINE_TEMPLATE_REGEX = /template\s*:\s*`([\s\S]*?)`/g;
const LINK_INPUT_DECLARATION_REGEX = /\b(textClass|anchorClass)\s*=\s*input\b/g;

export type ContentfulAssetClassesTask = {
  id: string;
  file: string;
  line: number;
  message: string;
};

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

type Removal = { offset: number; tagName: string; input: string; attribute: string };

const lineOf = (source: string, index: number) => source.slice(0, index).split('\n').length;

const findTagEnd = (source: string, from: number) => {
  let quote: string | null = null;

  for (let index = from; index < source.length; index++) {
    const character = source[index];

    if (quote) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '>') {
      return index;
    }
  }

  return -1;
};

const isInsideQuotes = (tag: string, index: number) => {
  let quote: string | null = null;

  for (let position = 0; position < index; position++) {
    const character = tag[position];

    if (quote) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
    }
  }

  return quote !== null;
};

const removeClassInputs = (template: string) => {
  const removals: Removal[] = [];
  let content = '';
  let cursor = 0;

  for (const tagMatch of template.matchAll(TAG_REGEX)) {
    const start = tagMatch.index ?? 0;

    if (start < cursor) continue;

    const end = findTagEnd(template, start);

    if (end === -1) break;

    const tagName = tagMatch[1] ?? '';
    const inputs = Object.keys(REMOVED_CLASS_INPUTS[tagName] ?? {});
    const attributeRegex = new RegExp(
      `(\\s+)(\\[?(${inputs.join('|')})\\]?(?:\\s*=\\s*(?:"[^"]*"|'[^']*'))?)(?=[\\s/>])`,
      'g',
    );
    const tag = template.slice(start, end + 1);
    const attributeMatches = [...tag.matchAll(attributeRegex)].filter(
      (attributeMatch) => !isInsideQuotes(tag, attributeMatch.index ?? 0),
    );
    let nextTag = tag;

    for (const attributeMatch of [...attributeMatches].reverse()) {
      const index = attributeMatch.index ?? 0;

      nextTag = nextTag.slice(0, index) + nextTag.slice(index + attributeMatch[0].length);
    }

    for (const attributeMatch of attributeMatches) {
      removals.push({
        offset: start + (attributeMatch.index ?? 0) + (attributeMatch[1] ?? '').length,
        tagName,
        input: attributeMatch[3] ?? '',
        attribute: attributeMatch[2] ?? '',
      });
    }

    content += template.slice(cursor, start) + nextTag;
    cursor = end + 1;
  }

  content += template.slice(cursor);

  return { content, removals };
};

const createRemovalTask = (filePath: string, line: number, removal: Removal): ContentfulAssetClassesTask => {
  const replacement = REMOVED_CLASS_INPUTS[removal.tagName]?.[removal.input] ?? '';

  return {
    id: `asset-class-input:${filePath}:${line}:${removal.input}`,
    file: filePath,
    line,
    message: `Removed \`${removal.attribute}\` from \`${removal.tagName}\`. Style the static \`.${replacement}\` class instead.`,
  };
};

const migrateHtmlFile = (filePath: string, source: string) => {
  const { content, removals } = removeClassInputs(source);

  return {
    content,
    tasks: removals.map((removal) => createRemovalTask(filePath, lineOf(source, removal.offset), removal)),
  };
};

const migrateTsFile = (filePath: string, source: string) => {
  const tasks: ContentfulAssetClassesTask[] = [];

  const content = source.replace(INLINE_TEMPLATE_REGEX, (match, template: string, offset: number) => {
    const templateOffset = offset + match.indexOf('`') + 1;
    const result = removeClassInputs(template);

    for (const removal of result.removals) {
      tasks.push(createRemovalTask(filePath, lineOf(source, templateOffset + removal.offset), removal));
    }

    return result.removals.length > 0 ? match.replace(template, () => result.content) : match;
  });

  for (const declaration of source.matchAll(LINK_INPUT_DECLARATION_REGEX)) {
    const line = lineOf(source, declaration.index ?? 0);

    tasks.push({
      id: `link-class-input:${filePath}:${line}`,
      file: filePath,
      line,
      message: `\`${declaration[1]}\` is declared as an input. If this is a custom \`components.link\`, the rich-text renderer no longer sets it - it passes \`marks\` (the shared mark types) and \`richText: true\` instead.`,
    });
  }

  return { content, tasks };
};

const renderReport = (tasks: ContentfulAssetClassesTask[]) =>
  [
    '# Contentful asset class inputs migration tasks',
    '',
    'The class inputs of `et-contentful-video`, `et-contentful-audio`, `et-contentful-file` and',
    '`et-contentful-link` are gone. Every inner element carries a static `et-contentful-*` class instead.',
    'The migration removed the bindings below; move their styling onto the named class. Delete this file when done.',
    '',
    ...tasks.map((task) =>
      [`## \`${task.id}\``, '', `- ${task.file}:${task.line}`, `- ${task.message}`, ''].join('\n'),
    ),
  ].join('\n');

export default async function migrateContentfulAssetClasses(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔄 Removing the Contentful asset class inputs...');

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const tasks: ContentfulAssetClassesTask[] = [];
  let filesChanged = 0;

  scope.visit(tree, (filePath) => {
    const isHtml = filePath.endsWith('.html');
    const isTs = filePath.endsWith('.ts') && !filePath.endsWith('.d.ts');

    if (!isHtml && !isTs) return;

    const before = tree.read(filePath, 'utf-8');
    if (!before) return;

    const result = isHtml ? migrateHtmlFile(filePath, before) : migrateTsFile(filePath, before);

    tasks.push(...result.tasks);

    if (result.content !== before) {
      tree.write(filePath, result.content);
      filesChanged++;
      console.log(`   ✓ ${filePath}`);
    }
  });

  if (tasks.length > 0) {
    tree.write(CONTENTFUL_ASSET_CLASSES_REPORT_PATH, renderReport(tasks));
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  console.log(`\n✅ Updated ${filesChanged} file(s).`);

  if (tasks.length > 0) {
    console.log(`⚠️  ${tasks.length} site(s) need their styling moved — see ${CONTENTFUL_ASSET_CLASSES_REPORT_PATH}.`);
  }
}
