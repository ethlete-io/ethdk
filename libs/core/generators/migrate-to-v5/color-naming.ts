import { Tree, logger } from '@nx/devkit';

/**
 * Symbol renames in TypeScript files (imports + usage).
 */
const TS_SYMBOL_RENAMES: Record<string, string> = {
  ProvideThemeDirective: 'ProvideColorDirective',
  THEME_PROVIDER: 'COLOR_PROVIDER',
  ColorThemedDirective: 'ColoredDirective',
  ColorThemedStylesComponent: 'ColoredStylesComponent',
  SurfaceThemedDirective: 'SurfacedDirective',
  SurfaceThemedStylesComponent: 'SurfacedStylesComponent',
  injectThemesPrefix: 'injectColorThemesPrefix',
  createCssThemeName: 'createCssColorThemeName',
};

/**
 * String replacements applied to HTML templates and inline templates.
 */
const TEMPLATE_REPLACEMENTS: [string, string][] = [
  ['[etProvideTheme]', '[etProvideColor]'],
  ['etProvideTheme', 'etProvideColor'],
  ['[etProvideAltTheme]', '[etProvideAltColor]'],
  ['etProvideAltTheme', 'etProvideAltColor'],
  ['[etColorThemed]', '[etColored]'],
  ['etColorThemed', 'etColored'],
  ['[etSurfaceThemed]', '[etSurfaced]'],
  ['etSurfaceThemed', 'etSurfaced'],
  ['[theme]=', '[color]='],
  ['[altTheme]=', '[altColor]='],
];

/**
 * CSS class name replacements.
 */
const CSS_REPLACEMENTS: [string, string][] = [
  ['.et-color-themed', '.et-colored'],
  ['.et-surface-themed', '.et-surfaced'],
  ['.et-theme--', '.et-color--'],
  ['.et-theme-alt--', '.et-color-alt--'],
];

/**
 * Host directive input alias replacements in TypeScript files.
 */
const HOST_DIRECTIVE_REPLACEMENTS: [string, string][] = [
  ["'etProvideTheme:theme'", "'etProvideColor:color'"],
  ["'etProvideAltTheme:altTheme'", "'etProvideAltColor:altColor'"],
  ["'etProvideTheme:color'", "'etProvideColor:color'"],
  ["'etProvideAltTheme:altColor'", "'etProvideAltColor:altColor'"],
  ['"etProvideTheme:theme"', '"etProvideColor:color"'],
  ['"etProvideAltTheme:altTheme"', '"etProvideAltColor:altColor"'],
  ['"etProvideTheme"', '"etProvideColor"'],
  ['"etProvideAltTheme"', '"etProvideAltColor"'],
];

export default async function migrateColorNaming(tree: Tree) {
  logger.log('\n🔄 Migrating theme → color naming...\n');

  const tsFiles: string[] = [];
  const htmlFiles: string[] = [];
  const cssFiles: string[] = [];

  findFiles('.', tree, tsFiles, htmlFiles, cssFiles);

  let filesModified = 0;

  for (const filePath of tsFiles) {
    const wasModified = migrateTypeScriptFile(tree, filePath);
    if (wasModified) {
      filesModified++;
      logger.log(`  ✓ ${filePath}`);
    }
  }

  for (const filePath of htmlFiles) {
    const wasModified = migrateTemplateFile(tree, filePath);
    if (wasModified) {
      filesModified++;
      logger.log(`  ✓ ${filePath}`);
    }
  }

  for (const filePath of cssFiles) {
    const wasModified = migrateCssFile(tree, filePath);
    if (wasModified) {
      filesModified++;
      logger.log(`  ✓ ${filePath}`);
    }
  }

  if (filesModified > 0) {
    logger.log(`\n✅ Successfully migrated color naming in ${filesModified} file(s)\n`);
  } else {
    logger.log('\nℹ️  No files needed migration\n');
  }
}

function findFiles(dir: string, tree: Tree, tsFiles: string[], htmlFiles: string[], cssFiles: string[]) {
  const children = tree.children(dir);

  for (const child of children) {
    const path = dir === '.' ? child : `${dir}/${child}`;

    if (tree.isFile(path)) {
      if (path.includes('node_modules')) continue;

      if (path.endsWith('.ts') && !path.endsWith('.spec.ts')) {
        tsFiles.push(path);
      } else if (path.endsWith('.html')) {
        htmlFiles.push(path);
      } else if (path.endsWith('.css') || path.endsWith('.scss')) {
        cssFiles.push(path);
      }
    } else {
      if (child === 'node_modules') continue;
      findFiles(path, tree, tsFiles, htmlFiles, cssFiles);
    }
  }
}

function migrateTypeScriptFile(tree: Tree, filePath: string): boolean {
  let content = tree.read(filePath, 'utf-8');
  if (!content) return false;

  const original = content;

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
