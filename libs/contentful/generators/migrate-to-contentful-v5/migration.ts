import { formatFiles, Tree, updateJson } from '@nx/devkit';
import { createMigrationScope, MigrationScopeOptions } from './migration-scope.js';

export const CONTENTFUL_V5_REPORT_PATH = 'contentful-v5-migration-tasks.md';

const COMPONENTS_PACKAGE = '@ethlete/components';
const COMPONENTS_VERSION = '^1.0.0-next.32';

/** Inputs that v5 dropped — the picture element now only carries static `et-picture-*` classes. */
const REMOVED_CLASS_INPUTS = ['imgClass', 'figureClass', 'figcaptionClass', 'pictureClass'];

/** Renderer internals that are no longer exported from `@ethlete/contentful`. */
const REMOVED_EXPORTS = [
  'RENDER_COMMAND_TYPE',
  'RENDER_COMMAND_POSITION',
  'HTML_OPEN_RENDER_COMMAND_POSITION',
  'HTML_CLOSE_RENDER_COMMAND_POSITION',
  'TEXT_RENDER_COMMAND_POSITION',
  'COMPONENT_RENDER_COMMAND_POSITION',
  'RENDER_INSTRUCTION_POSITION',
  'RENDER_INSTRUCTION_TYPE',
  'isHtmlOpenRenderCommand',
  'isHtmlCloseRenderCommand',
  'isTextRenderCommand',
  'isComponentRenderCommand',
  'getRenderCommandId',
  'isExecutedComponentCommandCacheItem',
  'isExecutedHtmlOrTextCommandCacheItem',
  'isExecutedTextCommandCacheItem',
];

const IMAGE_TAG_REGEX = /<et-contentful-image\b[^>]*>/g;
const INLINE_TEMPLATE_REGEX = /template\s*:\s*`([\s\S]*?)`/g;
const CONTENTFUL_IMPORT_REGEX = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]@ethlete\/contentful['"]/g;

export type ContentfulV5Task = {
  id: string;
  file: string;
  line?: number;
  message: string;
};

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

const lineOf = (source: string, index: number) => source.slice(0, index).split('\n').length;

/** Renames `hasPriority` to `priority` and collects removed class inputs, on `et-contentful-image` only. */
const migrateTemplate = (template: string) => {
  let changed = false;
  const classInputHits: { line: number; inputs: string[] }[] = [];

  const content = template.replace(IMAGE_TAG_REGEX, (tag, offset: number) => {
    const foundInputs = REMOVED_CLASS_INPUTS.filter((input) =>
      new RegExp(`(^|[\\s[])${input}(\\]|=|(?=[\\s/>]))`).test(tag),
    );

    if (foundInputs.length > 0) {
      classInputHits.push({ line: lineOf(template, offset), inputs: foundInputs });
    }

    const next = tag
      .replace(/\[hasPriority\]=/g, '[priority]=')
      .replace(/(^|\s)hasPriority(=|(?=[\s/>]))/g, '$1priority$2');

    if (next !== tag) changed = true;

    return next;
  });

  return { content, changed, classInputHits };
};

const migrateHtmlFile = (filePath: string, source: string) => {
  const { content, changed, classInputHits } = migrateTemplate(source);

  return { content, changed, tasks: classInputHits.map((hit) => createClassInputTask(filePath, hit)) };
};

const createClassInputTask = (filePath: string, hit: { line: number; inputs: string[] }): ContentfulV5Task => ({
  id: `image-class-input:${filePath}:${hit.line}`,
  file: filePath,
  line: hit.line,
  message: `\`et-contentful-image\` still sets ${hit.inputs
    .map((input) => `\`${input}\``)
    .join(
      ', ',
    )}. Those inputs were removed — the rendered picture now only carries static \`et-picture-*\` classes. Drop the binding and target the \`et-picture-*\` classes from your own CSS instead.`,
});

/** Matches a whole `useTailwindClasses: <literal>,` property line — the option was removed in v5. */
const USE_TAILWIND_CLASSES_REGEX = /^[ \t]*useTailwindClasses\s*:\s*(?:true|false|[\w.]+)\s*,?[ \t]*\r?\n/gm;

const migrateTsFile = (filePath: string, source: string) => {
  const tasks: ContentfulV5Task[] = [];
  let changed = false;

  source = source.replace(USE_TAILWIND_CLASSES_REGEX, () => {
    changed = true;

    return '';
  });

  const content = source.replace(INLINE_TEMPLATE_REGEX, (match, template: string, offset: number) => {
    const result = migrateTemplate(template);
    const templateStartLine = lineOf(source, offset + match.indexOf('`'));

    for (const hit of result.classInputHits) {
      tasks.push(createClassInputTask(filePath, { ...hit, line: templateStartLine + hit.line - 1 }));
    }

    if (!result.changed) return match;

    changed = true;

    return match.replace(template, () => result.content);
  });

  for (const importMatch of source.matchAll(CONTENTFUL_IMPORT_REGEX)) {
    const symbols = (importMatch[1] ?? '')
      .split(',')
      .map(
        (specifier) =>
          specifier
            .trim()
            .replace(/^type\s+/, '')
            .split(/\s+as\s+/)[0]
            ?.trim() ?? '',
      )
      .filter(Boolean);

    for (const symbol of symbols) {
      if (!REMOVED_EXPORTS.includes(symbol)) continue;

      tasks.push({
        id: `removed-export:${filePath}:${symbol}`,
        file: filePath,
        line: lineOf(source, importMatch.index ?? 0),
        message: `\`${symbol}\` is no longer public API. The render pipeline moved to plain objects internally, so the renderer command helpers are gone. Remove the usage, or vendor the logic into your own code.`,
      });
    }
  }

  return { content, changed, tasks };
};

const migratePackageJson = (tree: Tree, filePath: string) => {
  const tasks: ContentfulV5Task[] = [];
  let changed = false;

  updateJson<Record<string, Record<string, string> | undefined>>(tree, filePath, (json) => {
    const dependencies = json['dependencies'];
    const peerDependencies = json['peerDependencies'];
    const section = dependencies?.['@ethlete/contentful']
      ? 'dependencies'
      : peerDependencies?.['@ethlete/contentful']
        ? 'peerDependencies'
        : null;

    if (!section) return json;

    const hasComponents = Boolean(dependencies?.[COMPONENTS_PACKAGE] ?? peerDependencies?.[COMPONENTS_PACKAGE]);

    if (!hasComponents) {
      json[section] = { ...json[section], [COMPONENTS_PACKAGE]: COMPONENTS_VERSION };
      changed = true;
      console.log(`   ✓ ${filePath}: added ${COMPONENTS_PACKAGE}@${COMPONENTS_VERSION} to ${section}`);
    }

    if (dependencies?.['@ethlete/cdk'] ?? peerDependencies?.['@ethlete/cdk']) {
      tasks.push({
        id: `cdk-dependency:${filePath}`,
        file: filePath,
        message:
          '`@ethlete/contentful` no longer depends on `@ethlete/cdk`. The dependency was left in place because you may use it directly — if nothing in this project imports `@ethlete/cdk`, remove it.',
      });
    }

    return json;
  });

  return { changed, tasks };
};

const renderReport = (tasks: ContentfulV5Task[]) =>
  [
    '# @ethlete/contentful v5 migration tasks',
    '',
    'The codemod renamed the `et-contentful-image` `hasPriority` input to `priority`, removed the dropped',
    '`useTailwindClasses` config option and made sure `@ethlete/components` is declared. The sites below',
    'need a decision a codemod cannot make.',
    '',
    'Recipes:',
    '',
    '- Removed class inputs (`imgClass`, `figureClass`, `figcaptionClass`, `pictureClass`): the picture markup',
    '  now carries static `et-picture-*` classes. Delete the binding and style those classes from your CSS.',
    '- Removed renderer internals: the render pipeline is plain objects internally now. Drop the usage, or copy',
    '  the helper into your own codebase.',
    '- A leftover `@ethlete/cdk` dependency: remove it unless your own code imports it.',
    '',
    ...tasks.map((task) =>
      [`## \`${task.id}\``, '', `- ${task.file}${task.line ? `:${task.line}` : ''}`, `- ${task.message}`, ''].join(
        '\n',
      ),
    ),
  ].join('\n');

export default async function migrateToContentfulV5(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔄 Migrating to @ethlete/contentful v5...');

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const tasks: ContentfulV5Task[] = [];
  let filesChanged = 0;

  scope.visit(tree, (filePath) => {
    if (filePath === CONTENTFUL_V5_REPORT_PATH) return;

    if (filePath.endsWith('package.json')) {
      const result = migratePackageJson(tree, filePath);

      tasks.push(...result.tasks);

      if (result.changed) filesChanged++;

      return;
    }

    const isHtml = filePath.endsWith('.html');
    const isTs = filePath.endsWith('.ts') && !filePath.endsWith('.d.ts');

    if (!isHtml && !isTs) return;

    const before = tree.read(filePath, 'utf-8');
    if (!before) return;

    const result = isHtml ? migrateHtmlFile(filePath, before) : migrateTsFile(filePath, before);

    tasks.push(...result.tasks);

    if (result.changed) {
      tree.write(filePath, result.content);
      filesChanged++;
      console.log(`   ✓ ${filePath}`);
    }
  });

  if (tasks.length > 0) {
    tree.write(CONTENTFUL_V5_REPORT_PATH, renderReport(tasks));
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  console.log(`\n✅ Updated ${filesChanged} file(s).`);

  if (tasks.length > 0) {
    console.log(`⚠️  ${tasks.length} site(s) need a manual decision — see ${CONTENTFUL_V5_REPORT_PATH}.`);
  }
}
