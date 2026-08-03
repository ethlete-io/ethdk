import { formatFiles, Tree } from '@nx/devkit';
import { ImportRewrite, readCdkImportedSymbols, renameReferences, rewriteCdkImports } from './imports.js';
import { isSinceSatisfied, readInstalledVersion } from './installed-version.js';
import { JUDGMENT_KINDS, loadMigrationMap, MECHANICAL_KINDS, MigrationEntry, MigrationMap } from './migration-map.js';
import { createMigrationScope, MigrationScopeOptions } from './migration-scope.js';
import {
  addSymbolSite,
  createEmptyReport,
  isReportEmpty,
  MigrationReport,
  renderReport,
  scanStyleSheet,
  scanTemplate,
} from './report.js';
import {
  findInlineStyleSpans,
  findInlineTemplateSpans,
  lineOfIndex,
  rewriteStyleSheet,
  rewriteTemplate,
  transformInlineSpans,
} from './templates.js';

export const MIGRATE_FROM_CDK_REPORT_PATH = 'migrate-from-cdk-tasks.md';

const TARGET_PACKAGES = ['@ethlete/components', '@ethlete/core'] as const;

/**
 * The one `rename+reshape` row that is still rewritten: the generator handles the whole reshape
 * (`mode`, `renderBackground`, `multiColor`, the colour variable) itself, so only the colour default is
 * left for the report.
 */
const SPINNER_SYMBOL = 'ProgressSpinnerComponent';

type MigrateFromCdkSchema = MigrationScopeOptions & {
  skipFormat?: boolean;

  /** Path to `migration-map.json`, when it cannot be found next to an installed `@ethlete/cdk`. */
  mapPath?: string;
};

const isTypeScript = (filePath: string) => filePath.endsWith('.ts') && !filePath.endsWith('.d.ts');
const isTemplate = (filePath: string) => filePath.endsWith('.html');
const isStyleSheet = (filePath: string) => /\.(css|scss)$/.test(filePath);
const isScannable = (filePath: string) => isTypeScript(filePath) || isTemplate(filePath) || isStyleSheet(filePath);

const collectRewrites = (map: MigrationMap, isAvailable: (entry: MigrationEntry) => boolean) => {
  const rewrites = new Map<string, ImportRewrite>();

  for (const [name, entry] of Object.entries(map)) {
    if (!entry.to || !entry.package) continue;

    const isMechanical = MECHANICAL_KINDS.includes(entry.kind) || name === SPINNER_SYMBOL;

    if (!isMechanical || !isAvailable(entry)) continue;

    rewrites.set(name, { to: entry.to, package: entry.package });
  }

  return rewrites;
};

const scanFile = (
  report: MigrationReport,
  filePath: string,
  content: string,
  map: MigrationMap,
  isAvailable: (entry: MigrationEntry) => boolean,
) => {
  if (isTemplate(filePath)) {
    scanTemplate(report, content, { file: filePath, startLine: 1 });

    return;
  }

  if (isStyleSheet(filePath)) {
    scanStyleSheet(report, content, { file: filePath, startLine: 1 });

    return;
  }

  for (const span of findInlineTemplateSpans(content, filePath)) {
    scanTemplate(report, span.text, { file: filePath, startLine: lineOfIndex(content, span.start) });
  }

  for (const span of findInlineStyleSpans(content, filePath)) {
    scanStyleSheet(report, span.text, { file: filePath, startLine: lineOfIndex(content, span.start) });
  }

  for (const { name, line } of readCdkImportedSymbols(content, filePath)) {
    const entry = map[name];

    if (!entry) continue;

    const site = { file: filePath, line };

    if (entry.since && !isAvailable(entry)) {
      addSymbolSite(report.gatedSymbols, name, entry, site);

      continue;
    }

    if (JUDGMENT_KINDS.includes(entry.kind) || name === SPINNER_SYMBOL) {
      addSymbolSite(report.judgmentSymbols, name, entry, site);
    }
  }
};

const rewriteFile = (filePath: string, content: string, rewrites: Map<string, ImportRewrite>) => {
  if (isTemplate(filePath)) return rewriteTemplate(content);
  if (isStyleSheet(filePath)) return rewriteStyleSheet(content);

  const { content: withImports, renames } = rewriteCdkImports(content, filePath, rewrites);
  const withReferences = renameReferences(withImports, filePath, renames);
  const withTemplates = transformInlineSpans(
    withReferences,
    findInlineTemplateSpans(withReferences, filePath),
    rewriteTemplate,
  );

  return transformInlineSpans(withTemplates, findInlineStyleSpans(withTemplates, filePath), rewriteStyleSheet);
};

export default async function migrateFromCdk(tree: Tree, schema: MigrateFromCdkSchema) {
  console.log('\n🔄 Migrating off @ethlete/cdk...');

  const map = loadMigrationMap(schema.mapPath);
  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const installedVersions = Object.fromEntries(
    TARGET_PACKAGES.map((packageName) => [packageName, readInstalledVersion(tree, packageName)]),
  );

  const isAvailable = (entry: MigrationEntry) =>
    !entry.since || isSinceSatisfied(installedVersions[entry.package ?? '@ethlete/components'] ?? null, entry.since);

  const rewrites = collectRewrites(map, isAvailable);
  const report = createEmptyReport();
  const files: string[] = [];

  scope.visit(tree, (filePath) => {
    if (!isScannable(filePath) || filePath === MIGRATE_FROM_CDK_REPORT_PATH) return;

    files.push(filePath);
  });

  for (const filePath of files) {
    const content = tree.read(filePath, 'utf-8');

    if (!content) continue;

    scanFile(report, filePath, content, map, isAvailable);
  }

  let rewrittenFiles = 0;

  for (const filePath of files) {
    const content = tree.read(filePath, 'utf-8');

    if (!content) continue;

    const next = rewriteFile(filePath, content, rewrites);

    if (next !== content) {
      tree.write(filePath, next);
      rewrittenFiles += 1;
    }
  }

  const hasTasks = !isReportEmpty(report);

  if (hasTasks) {
    tree.write(MIGRATE_FROM_CDK_REPORT_PATH, renderReport(report, { installedVersions, rewrittenFiles }));
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  console.log(`   ✓ Rewrote ${rewrittenFiles} file(s)`);

  if (hasTasks) {
    console.log(`\n⚠️  Some changes need a decision - see ${MIGRATE_FROM_CDK_REPORT_PATH}.`);
  } else {
    console.log('\n✅ Nothing left that needs a decision.');
  }
}
