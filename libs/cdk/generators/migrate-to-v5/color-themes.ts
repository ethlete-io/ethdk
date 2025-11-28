import { Tree, logger, readJson, visitNotIgnoredFiles, writeJson } from '@nx/devkit';

// Theming-related exports that moved from @ethlete/theming and @ethlete/cdk to @ethlete/core
const THEMING_EXPORTS = new Set([
  'ProvideThemeDirective',
  'THEME_PROVIDER',
  'Theme',
  'ThemeSwatch',
  'OnThemeColorMap',
  'ThemeColorMap',
  'ThemeColor',
  'ThemeHSLColor',
  'ThemeRGBColor',
  'provideThemes',
  'provideColorThemes',
]);

export default async function migrateColorThemes(tree: Tree) {
  console.log('\n🔄 Migrating provideThemes to provideColorThemes and imports to @ethlete/core');

  let filesModified = 0;
  let functionReplacements = 0;
  let importsMoved = 0;
  let importsMerged = 0;
  let packagesRemoved = 0;

  // Migrate TypeScript files
  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!filePath.endsWith('.ts')) {
      return;
    }

    const content = tree.read(filePath, 'utf-8');
    if (!content) {
      return;
    }

    // Check if file contains provideThemes or imports from @ethlete/theming or @ethlete/cdk
    if (
      !content.includes('provideThemes') &&
      !content.includes('@ethlete/theming') &&
      !content.includes('@ethlete/cdk')
    ) {
      return;
    }

    let modified = content;
    let fileChanges = 0;

    // Replace provideThemes with provideColorThemes
    const beforeProvideThemesCount = (modified.match(/\bprovideThemes\b/g) || []).length;
    modified = modified.replace(/\bprovideThemes\b/g, 'provideColorThemes');
    fileChanges += beforeProvideThemesCount;
    functionReplacements += beforeProvideThemesCount;

    // Handle import merging from @ethlete/theming and @ethlete/cdk to @ethlete/core
    const themingImportPattern = /import\s*{([^}]*)}\s*from\s*['"]@ethlete\/theming['"]/g;
    const cdkImportPattern = /import\s*{([^}]*)}\s*from\s*['"]@ethlete\/cdk['"]/g;
    const coreImportPattern = /import\s*{([^}]*)}\s*from\s*['"]@ethlete\/core['"]/;

    const themingImportsToMove: string[] = [];
    const cdkThemingImportsToMove: string[] = [];
    const cdkNonThemingImports: string[] = [];

    let themingMatch: RegExpExecArray | null;
    let cdkMatch: RegExpExecArray | null;

    // Collect all imports from @ethlete/theming (all should be moved)
    while ((themingMatch = themingImportPattern.exec(modified)) !== null) {
      const imports = themingMatch[1]!
        .split(',')
        .map((imp) => imp.trim())
        .filter((imp) => imp.length > 0);
      // Keep the full import string including 'type' keyword and aliases
      themingImportsToMove.push(...imports);
    }

    // Collect imports from @ethlete/cdk and separate theming vs non-theming
    while ((cdkMatch = cdkImportPattern.exec(modified)) !== null) {
      const imports = cdkMatch[1]!
        .split(',')
        .map((imp) => imp.trim())
        .filter((imp) => imp.length > 0);

      imports.forEach((imp) => {
        // Extract the actual import name (without 'type' keyword and alias)
        // Handle patterns like: "type Theme as EthleteTheme", "Theme", "type Theme"
        const typeKeywordMatch = imp.match(/^type\s+/);
        const hasTypeKeyword = !!typeKeywordMatch;
        const withoutType = imp.replace(/^type\s+/, '').trim();
        const importName = withoutType.split(/\s+as\s+/)[0]?.trim() || withoutType;

        if (THEMING_EXPORTS.has(importName)) {
          cdkThemingImportsToMove.push(imp); // Keep the original import with type keyword and alias
        } else {
          cdkNonThemingImports.push(imp); // Keep the original import with type keyword and alias
        }
      });
    }

    const allThemingImports = [...themingImportsToMove, ...cdkThemingImportsToMove];

    if (allThemingImports.length > 0) {
      // Check if there's already a @ethlete/core import
      const existingCoreImport = modified.match(coreImportPattern);

      if (existingCoreImport) {
        // Merge theming imports with existing @ethlete/core import
        const existingImports = existingCoreImport[1]!
          .split(',')
          .map((imp) => imp.trim())
          .filter((imp) => imp.length > 0);

        const allImports = [...existingImports, ...allThemingImports];

        // Remove duplicates while preserving order and type keywords
        // We need to compare the actual import names (without type and aliases) for deduplication
        const seen = new Set<string>();
        const uniqueImports = allImports.filter((imp) => {
          const withoutType = imp.replace(/^type\s+/, '').trim();
          const importName = withoutType.split(/\s+as\s+/)[0]?.trim() || withoutType;

          if (seen.has(importName)) {
            return false;
          }
          seen.add(importName);
          return true;
        });

        // Replace the existing @ethlete/core import with merged imports
        modified = modified.replace(coreImportPattern, `import { ${uniqueImports.join(', ')} } from '@ethlete/core'`);

        importsMerged++;
        fileChanges++;
      } else {
        // No existing @ethlete/core import, create a new one
        const uniqueImports = Array.from(new Set(allThemingImports));

        // Find the position of the first theming import to replace
        const firstThemingImport = modified.match(/import\s*{[^}]*}\s*from\s*['"]@ethlete\/theming['"];?\s*\n?/);

        if (firstThemingImport) {
          // Replace first theming import with core import
          modified = modified.replace(
            /import\s*{[^}]*}\s*from\s*['"]@ethlete\/theming['"];?\s*\n?/,
            `import { ${uniqueImports.join(', ')} } from '@ethlete/core';\n`,
          );
        } else {
          // Add new @ethlete/core import at the beginning (after first import)
          const firstImportMatch = modified.match(/import\s+[^;]+;/);
          if (firstImportMatch) {
            const insertPosition = firstImportMatch.index! + firstImportMatch[0].length;
            modified =
              modified.slice(0, insertPosition) +
              `\nimport { ${uniqueImports.join(', ')} } from '@ethlete/core';` +
              modified.slice(insertPosition);
          }
        }

        importsMoved++;
        fileChanges++;
      }

      // Remove all @ethlete/theming imports
      modified = modified.replace(/import\s*{[^}]*}\s*from\s*['"]@ethlete\/theming['"];?\s*\n?/g, '');

      // Handle @ethlete/cdk imports - only process if we found theming imports to move
      if (cdkThemingImportsToMove.length > 0) {
        // Remove all existing @ethlete/cdk imports first
        modified = modified.replace(/import\s*{[^}]*}\s*from\s*['"]@ethlete\/cdk['"];?\s*\n?/g, '');

        if (cdkNonThemingImports.length > 0) {
          // Add back only the non-theming imports after the @ethlete/core import
          const cdkImportStatement = `import { ${cdkNonThemingImports.join(', ')} } from '@ethlete/cdk';\n`;
          const coreImportMatch = modified.match(/import\s*{[^}]*}\s*from\s*['"]@ethlete\/core['"];?\s*\n?/);

          if (coreImportMatch) {
            const insertPosition = coreImportMatch.index! + coreImportMatch[0].length;
            modified = modified.slice(0, insertPosition) + cdkImportStatement + modified.slice(insertPosition);
          } else {
            // If no core import exists, add after the first import
            const firstImportMatch = modified.match(/import\s+[^;]+;/);
            if (firstImportMatch) {
              const insertPosition = firstImportMatch.index! + firstImportMatch[0].length;
              modified = modified.slice(0, insertPosition) + '\n' + cdkImportStatement + modified.slice(insertPosition);
            }
          }
        }

        // Clean up any resulting double newlines
        modified = modified.replace(/\n\n\n+/g, '\n\n');

        fileChanges++;
      }
    }

    if (modified !== content) {
      tree.write(filePath, modified);
      filesModified++;
      console.log(`   ✓ ${filePath} (${fileChanges} change${fileChanges !== 1 ? 's' : ''})`);
    }
  });

  // Remove @ethlete/theming from package.json files (but keep @ethlete/cdk)
  const packageJsonFiles = ['package.json'];

  // Also check for package.json in apps and libs
  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (filePath.endsWith('package.json') && !packageJsonFiles.includes(filePath)) {
      packageJsonFiles.push(filePath);
    }
  });

  for (const packageJsonPath of packageJsonFiles) {
    if (!tree.exists(packageJsonPath)) {
      continue;
    }

    try {
      const packageJson = readJson(tree, packageJsonPath);
      let modified = false;

      // Remove @ethlete/theming from dependencies
      if (packageJson.dependencies && packageJson.dependencies['@ethlete/theming']) {
        delete packageJson.dependencies['@ethlete/theming'];
        modified = true;
        console.log(`   ✓ Removed @ethlete/theming from ${packageJsonPath} dependencies`);
      }

      // Remove @ethlete/theming from devDependencies
      if (packageJson.devDependencies && packageJson.devDependencies['@ethlete/theming']) {
        delete packageJson.devDependencies['@ethlete/theming'];
        modified = true;
        console.log(`   ✓ Removed @ethlete/theming from ${packageJsonPath} devDependencies`);
      }

      // Remove @ethlete/theming from peerDependencies
      if (packageJson.peerDependencies && packageJson.peerDependencies['@ethlete/theming']) {
        delete packageJson.peerDependencies['@ethlete/theming'];
        modified = true;
        console.log(`   ✓ Removed @ethlete/theming from ${packageJsonPath} peerDependencies`);
      }

      if (modified) {
        writeJson(tree, packageJsonPath, packageJson);
        packagesRemoved++;
      }
    } catch (error) {
      logger.warn(`Failed to process ${packageJsonPath}: ${error}`);
    }
  }

  console.log(`\n✅ Color themes migration complete:`);
  console.log(`   📝 Files modified: ${filesModified}`);
  console.log(`   🔄 Function replacements: ${functionReplacements}`);
  console.log(`   📦 Imports moved: ${importsMoved}`);
  console.log(`   🔗 Imports merged: ${importsMerged}`);
  console.log(`   🗑️  Package.json files updated: ${packagesRemoved}`);

  if (packagesRemoved > 0) {
    console.log(`\n⚠️  Don't forget to run 'yarn install' to update your lock file!`);
  }
}
