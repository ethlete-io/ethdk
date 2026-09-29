import { Tree } from '@nx/devkit';
import { MigrationScope } from '../migrate-provider-shape/migration-scope.js';
import { collectFiles, TransformReport } from './migration-files.js';

/**
 * Symbol renames in TypeScript files (imports + usage).
 */
const TS_SYMBOL_RENAMES: Record<string, string> = {
  ProvideThemeDirective: 'ProvideColorDirective',
  THEME_PROVIDER: 'COLOR_PROVIDER',
  ColorThemedDirective: 'ColorInteractiveDirective',
  ColorThemedStylesComponent: 'ColorInteractiveStylesComponent',
  SurfaceThemedDirective: 'SurfaceInteractiveDirective',
  SurfaceThemedStylesComponent: 'SurfaceInteractiveStylesComponent',
  injectThemesPrefix: 'injectColorThemesPrefix',
  createCssThemeName: 'createCssColorThemeName',
};

/**
 * String replacements applied to HTML templates and inline templates.
 */
const TEMPLATE_REPLACEMENTS: [string, string][] = [
  ['[etProvideTheme]', '[etProvideColor]'],
  ['etProvideTheme', 'etProvideColor'],
  ['[etColorThemed]', '[etColorInteractive]'],
  ['etColorThemed', 'etColorInteractive'],
  ['[etSurfaceThemed]', '[etSurfaceInteractive]'],
  ['etSurfaceThemed', 'etSurfaceInteractive'],
  ['et-theme-alt--', 'et-color-alt--'],
  ['et-theme--', 'et-color--'],
];

/**
 * CSS class name replacements.
 */
const CSS_REPLACEMENTS: [string, string][] = [
  ['.et-color-themed', '.et-color-interactive'],
  ['.et-surface-themed', '.et-surface-interactive'],
  ['.et-theme--', '.et-color--'],
  ['.et-theme-alt--', '.et-color-alt--'],
];

/**
 * Host directive input alias replacements in TypeScript files.
 */
const HOST_DIRECTIVE_REPLACEMENTS: [string, string][] = [
  ["'etProvideTheme:theme'", "'etProvideColor:color'"],
  ["'etProvideTheme:color'", "'etProvideColor:color'"],
  ['"etProvideTheme:theme"', '"etProvideColor:color"'],
  ['"etProvideTheme"', '"etProvideColor"'],
  ["'etProvideTheme: theme'", "'etProvideColor: color'"],
  ['"etProvideTheme: theme"', '"etProvideColor: color"'],
];

export default async function migrateColorNaming(tree: Tree, scope?: MigrationScope): Promise<TransformReport> {
  let filesModified = 0;

  for (const filePath of collectFiles(tree, scope, ['.ts', '.html', '.css', '.scss'])) {
    const wasModified = filePath.endsWith('.ts')
      ? migrateTypeScriptFile(tree, filePath)
      : filePath.endsWith('.html')
        ? migrateTemplateFile(tree, filePath)
        : migrateCssFile(tree, filePath);

    if (wasModified) filesModified++;
  }

  return { filesChanged: filesModified, review: [] };
}

function migrateTypeScriptFile(tree: Tree, filePath: string): boolean {
  let content = tree.read(filePath, 'utf-8');
  if (!content) return false;

  const original = content;

  if (!/from\s+['"]@ethlete\/(?:core|cdk|theming)['"]/.test(content)) return false;

  // Rename symbols
  for (const [oldName, newName] of Object.entries(TS_SYMBOL_RENAMES)) {
    content = replaceWholeWord(content, oldName, newName);
  }

  // Rename host directive input aliases
  for (const [oldStr, newStr] of HOST_DIRECTIVE_REPLACEMENTS) {
    content = content.replaceAll(oldStr, newStr);
  }

  // Handle inline templates in TypeScript files
  for (const [oldStr, newStr] of TEMPLATE_REPLACEMENTS) {
    content = content.replaceAll(oldStr, newStr);
  }

  // Handle CSS in TypeScript files
  for (const [oldStr, newStr] of CSS_REPLACEMENTS) {
    content = content.replaceAll(oldStr, newStr);
  }

  if (content !== original) {
    tree.write(filePath, content);

    return true;
  }

  return false;
}

function migrateTemplateFile(tree: Tree, filePath: string): boolean {
  let content = tree.read(filePath, 'utf-8');
  if (!content) return false;

  const original = content;

  for (const [oldStr, newStr] of TEMPLATE_REPLACEMENTS) {
    content = content.replaceAll(oldStr, newStr);
  }

  if (content !== original) {
    tree.write(filePath, content);

    return true;
  }

  return false;
}

function migrateCssFile(tree: Tree, filePath: string): boolean {
  let content = tree.read(filePath, 'utf-8');
  if (!content) return false;

  const original = content;

  for (const [oldStr, newStr] of CSS_REPLACEMENTS) {
    content = content.replaceAll(oldStr, newStr);
  }

  if (content !== original) {
    tree.write(filePath, content);

    return true;
  }

  return false;
}

function replaceWholeWord(content: string, oldWord: string, newWord: string): string {
  const regex = new RegExp(`\\b${escapeRegex(oldWord)}\\b`, 'g');

  return content.replace(regex, newWord);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
