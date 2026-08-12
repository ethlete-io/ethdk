import { formatFiles, logger, readProjectConfiguration, Tree, visitNotIgnoredFiles } from '@nx/devkit';
import { join } from 'node:path';
import { ComponentCategory, ComponentNames, componentNames } from './component-names';
import {
  barrelFile,
  componentFile,
  docsFile,
  errorsFile,
  headlessBarrelFile,
  importsFile,
  specFile,
  storiesFile,
  storybookComponentFile,
  stylesFile,
  TemplateOptions,
  Tier,
  TIERS,
  directiveFile,
} from './component-templates';
import {
  claimErrorCodeBlock as claimErrorCodeBlockRow,
  insertBarrelExport,
  insertDocsSidebarEntry,
  nextErrorCodeBlock,
} from './workspace-edits';

type GeneratorSchema = {
  name: string;
  project?: string;
  category?: ComponentCategory;
  tier?: Tier;
  errors?: boolean;
  stories?: boolean;
  spec?: boolean;
  docs?: boolean;
  docsGroup?: string;
  docsRoot?: string;
  skipFormat?: boolean;
};

const DEFAULT_PROJECT = 'components';
const DEFAULT_TIER: Tier = 'both';
const DEFAULT_DOCS_ROOT = 'apps/docs';
const DEFAULT_DOCS_GROUP = 'Layout & structure';
const ARCHITECTURE_DOC = 'docs/COMPONENT-ARCHITECTURE.md';

export default async function generate(tree: Tree, schema: GeneratorSchema) {
  logger.log('\n🧱 Scaffolding an Ethlete component domain...\n');

  const tier = schema.tier ?? DEFAULT_TIER;

  if (!TIERS.includes(tier)) {
    logger.error(`❌ Unknown tier "${tier}". Use one of: ${TIERS.join(', ')}.`);

    return;
  }

  let names: ComponentNames;
  try {
    names = componentNames(schema.name, schema.category);
  } catch (error) {
    logger.error(`❌ ${error instanceof Error ? error.message : String(error)}`);

    return;
  }

  const projectName = schema.project || DEFAULT_PROJECT;
  let sourceRoot: string;
  try {
    const project = readProjectConfiguration(tree, projectName);
    sourceRoot = project.sourceRoot ?? join(project.root, 'src');
  } catch {
    logger.error(`❌ No project named "${projectName}" in this workspace. Pass --project.`);

    return;
  }

  const domainDir = join(sourceRoot, 'lib', names.fileName);

  if (tree.exists(domainDir)) {
    logger.error(`❌ ${domainDir} already exists. Pick another name or delete it first.`);

    return;
  }

  const options: TemplateOptions = { tier, errors: schema.errors ?? false };
  const written: string[] = [];

  const write = (path: string, content: string) => {
    tree.write(path, content);
    written.push(path);
  };

  if (tier === 'both') {
    write(join(domainDir, 'headless', `${names.fileName}.directive.ts`), directiveFile(names));
    write(join(domainDir, 'headless', 'index.ts'), headlessBarrelFile(names));
  } else if (tier === 'headless') {
    write(join(domainDir, `${names.fileName}.directive.ts`), directiveFile(names));
  }

  if (tier !== 'headless') {
    write(join(domainDir, `${names.fileName}.component.ts`), componentFile(names, options));
    write(join(domainDir, `${names.fileName}.component.css`), stylesFile(names));
  }

  if (options.errors) {
    const block = allocateErrorBlock(tree, sourceRoot);

    write(join(domainDir, `${names.fileName}-errors.ts`), errorsFile(names, block));

    const claimed = claimErrorCodeBlock(tree, names, block);

    if (claimed) written.push(claimed);
  }

  write(join(domainDir, `${names.fileName}.imports.ts`), importsFile(names, options));
  write(join(domainDir, 'index.ts'), barrelFile(names, options));

  if (schema.spec ?? true) {
    const suffix = tier === 'headless' ? 'directive' : 'component';

    write(join(domainDir, `${names.fileName}.${suffix}.spec.ts`), specFile(names, options));
  }

  if (schema.stories ?? true) {
    write(
      join(domainDir, 'stories', `${names.fileName}-storybook.component.ts`),
      storybookComponentFile(names, options),
    );
    write(join(domainDir, 'stories', `${names.fileName}.stories.ts`), storiesFile(names));
  }

  const rootBarrel = join(sourceRoot, 'index.ts');

  if (tree.exists(rootBarrel)) {
    tree.write(rootBarrel, insertBarrelExport(tree.read(rootBarrel, 'utf-8') ?? '', names.fileName));
    written.push(rootBarrel);
  } else {
    logger.warn(`⚠️  No barrel at ${rootBarrel} - export the domain yourself.`);
  }

  if (schema.docs ?? true) {
    written.push(...writeDocs(tree, names, options, schema));
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  logger.log(`✅ ${written.length} file(s) written:\n   - ${written.join('\n   - ')}`);
  logger.log(`\nNext:
   - fill in the JSDoc and docs prose the scaffold left as placeholders
   - add a changeset (.changeset/*.md, minor for @ethlete/components)
   - nx lint ${projectName} --fix && nx test ${projectName}\n`);
}

/** Records the claimed block in the architecture doc, when the workspace has one. */
function claimErrorCodeBlock(tree: Tree, names: ComponentNames, block: number): string | null {
  if (!tree.exists(ARCHITECTURE_DOC)) {
    return null;
  }

  const before = tree.read(ARCHITECTURE_DOC, 'utf-8') ?? '';
  const after = claimErrorCodeBlockRow(before, block, names.title);

  if (after === before) {
    logger.warn(`⚠️  Could not update the code range table in ${ARCHITECTURE_DOC} - claim ${block} yourself.`);

    return null;
  }

  tree.write(ARCHITECTURE_DOC, after);

  return ARCHITECTURE_DOC;
}

/** The next unused 100-code block across every `*-errors.ts` in the lib. */
function allocateErrorBlock(tree: Tree, sourceRoot: string): number {
  const contents: string[] = [];

  visitNotIgnoredFiles(tree, join(sourceRoot, 'lib'), (path) => {
    if (path.endsWith('-errors.ts')) {
      contents.push(tree.read(path, 'utf-8') ?? '');
    }
  });

  return nextErrorCodeBlock(contents);
}

function writeDocs(tree: Tree, names: ComponentNames, options: TemplateOptions, schema: GeneratorSchema): string[] {
  const docsRoot = schema.docsRoot || DEFAULT_DOCS_ROOT;
  const page = join(docsRoot, 'components', `${names.fileName}.md`);

  if (!tree.exists(join(docsRoot, 'components'))) {
    logger.warn(`⚠️  No docs site at ${docsRoot} - skipping the guide page.`);

    return [];
  }

  const written = [page];
  tree.write(page, docsFile(names, options));

  const config = join(docsRoot, '.vitepress', 'config.mts');

  if (!tree.exists(config)) {
    logger.warn(`⚠️  No ${config} - add the sidebar entry yourself.`);

    return written;
  }

  const group = schema.docsGroup || DEFAULT_DOCS_GROUP;
  const before = tree.read(config, 'utf-8') ?? '';
  const after = insertDocsSidebarEntry(before, group, names.title, `/components/${names.fileName}`);

  if (after === before) {
    logger.warn(`⚠️  Could not find the "${group}" sidebar group in ${config} - add the entry yourself.`);

    return written;
  }

  tree.write(config, after);
  written.push(config);

  return written;
}
