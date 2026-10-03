import { formatFiles, Tree } from '@nx/devkit';
import { writeFileSync } from 'fs';
import { createMigrationScope, MigrationScopeOptions } from '../migrate-provider-shape/migration-scope.js';
import {
  LegacyColorThemesHelperSite,
  LegacyColorThemesSite,
  migrateLegacyColorThemesInFile,
} from './legacy-color-themes.js';

export const LEGACY_COLOR_THEMES_REPORT_PATH = 'legacy-color-themes-migration-tasks.md';
export const LEGACY_COLOR_THEMES_GUIDE = 'https://ethlete-sdk-docs.web.app/core/theming#migrating-from-runtime-theming';

const SCAN_FILE_ENV = 'ETHLETE_SCAN_FILE';

type MigrationSchema = MigrationScopeOptions & {
  skipFormat?: boolean;
};

type Findings = {
  providerSites: LegacyColorThemesSite[];
  helperSites: LegacyColorThemesHelperSite[];
  providesSurfaceThemes: boolean;
};

const generatorCommand = (site: LegacyColorThemesSite) =>
  site.themesFrom
    ? `nx g @ethlete/core:tailwind-4-color-theme --themesPath=<the file behind '${site.themesFrom}'>`
    : 'nx g @ethlete/core:tailwind-4-color-theme --themesPath=<the file that exports the themes>';

export const renderLegacyColorThemesReport = (findings: Findings) =>
  [
    '# Legacy color themes migration tasks',
    '',
    `The codemod rewrote \`provideColorThemes(…)\` into \`provideColorThemesWithTailwind4(…)\`. The new provider no`,
    'longer injects the theme CSS at runtime, so the steps below finish the move to Tailwind 4. The guide is',
    `${LEGACY_COLOR_THEMES_GUIDE}.`,
    '',
    '## Generate and import the color theme CSS',
    '',
    'Run the color generator once per themes file, with the prefix the Tailwind 3 config used, and import the',
    'generated `.css` in the global stylesheet of every app below:',
    '',
    ...findings.providerSites.map(
      (site) =>
        `- ${site.file}:${site.line}${site.themes ? ` - themes \`${site.themes}\`` : ''}: \`${generatorCommand(site)}\``,
    ),
    '',
    ...(findings.helperSites.length > 0
      ? [
          '## Remove the Tailwind 3 color config',
          '',
          'These Tailwind 3 helpers build the color utilities the generated CSS now emits through `@theme`. Delete',
          'the color block and move the config to Tailwind 4:',
          '',
          ...findings.helperSites.map((site) => `- ${site.file}:${site.line} - \`${site.helper}\``),
          '',
        ]
      : []),
    ...(findings.providesSurfaceThemes
      ? []
      : [
          '## Add surface themes',
          '',
          'No app in scope calls `provideSurfaceThemesWithTailwind4()`, and every component reads its backgrounds,',
          'text and borders from a surface theme. Build a first set from the app’s existing colors: one `light`',
          'surface (`isDefault: true`, elevation 0) from the page background, text, muted text and border colors,',
          'and a `light-elevated` one for cards and overlays; add `dark` surfaces only if the app has a dark mode.',
          'Generate them with `nx g @ethlete/core:tailwind-4-surface-theme`, import the generated `.css`, and',
          'register them next to the color themes with `provideSurfaceThemesWithTailwind4(SURFACE_THEMES)`.',
          '',
        ]),
    '## Check the app’s own CSS',
    '',
    '`--et-color-primary` and its states keep working. `--et-color-alt-*` is gone: put the region in its own',
    '`etProvideColor` scope and read `--et-color-primary` there.',
    '',
  ].join('\n');

export default async function migrateLegacyColorThemes(tree: Tree, schema: MigrationSchema) {
  console.log('\n🔄 Migrating provideColorThemes to provideColorThemesWithTailwind4...');

  const scope = createMigrationScope(tree, schema);

  console.log(`   Scope: ${scope.describe()}`);

  const findings: Findings = { providerSites: [], helperSites: [], providesSurfaceThemes: false };
  const rewrites = new Map<string, string>();

  scope.visit(tree, (filePath) => {
    if (!/\.[cm]?[jt]s$/.test(filePath) || filePath.endsWith('.d.ts')) return;

    const before = tree.read(filePath, 'utf-8');

    if (!before) return;

    const result = migrateLegacyColorThemesInFile(filePath, before);

    findings.providerSites.push(...result.providerSites);
    findings.helperSites.push(...result.helperSites);
    findings.providesSurfaceThemes ||= result.providesSurfaceThemes;

    if (result.changed) rewrites.set(filePath, result.content);
  });

  const scanFile = process.env[SCAN_FILE_ENV];

  if (scanFile) {
    writeFileSync(scanFile, JSON.stringify([...rewrites.keys()].sort()), 'utf8');

    return;
  }

  if (rewrites.size === 0) {
    console.log('   Nothing to migrate.\n');

    return;
  }

  for (const [filePath, content] of rewrites) {
    tree.write(filePath, content);
    console.log(`   ✓ ${filePath}`);
  }

  tree.write(LEGACY_COLOR_THEMES_REPORT_PATH, renderLegacyColorThemesReport(findings));

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  console.log(`\n✅ Rewrote ${rewrites.size} file(s).`);
  console.log(`⚠️  The Tailwind 4 setup is not done yet - see ${LEGACY_COLOR_THEMES_REPORT_PATH}.`);
}
