import { Tree, logger, readJson, visitNotIgnoredFiles, writeJson } from '@nx/devkit';

export default async function migrateColorThemes(tree: Tree) {
  console.log('\n🔄 Migrating provideThemes to provideColorThemes and @ethlete/theming to @ethlete/cdk');

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

    // Check if file contains provideThemes or imports from @ethlete/theming
    if (!content.includes('provideThemes') && !content.includes('@ethlete/theming')) {
      return;
    }

    let modified = content;
    let fileChanges = 0;

    // Replace provideThemes with provideColorThemes
    const beforeProvideThemesCount = (modified.match(/\bprovideThemes\b/g) || []).length;
    modified = modified.replace(/\bprovideThemes\b/g, 'provideColorThemes');
    fileChanges += beforeProvideThemesCount;
    functionReplacements += beforeProvideThemesCount;

    // Handle import merging
    const themingImportPattern = /import\s*{([^}]*)}\s*from\s*['"]@ethlete\/theming['"]/g;
    const cdkImportPattern = /import\s*{([^}]*)}\s*from\s*['"]@ethlete\/cdk['"]/;

    const themingImports: string[][] = [];
    let themingMatch: RegExpExecArray | null;

    while ((themingMatch = themingImportPattern.exec(modified)) !== null) {
      const imports = themingMatch[1]!
        .split(',')
        .map((imp) => imp.trim())
        .filter((imp) => imp.length > 0);
      themingImports.push(imports);
    }

    if (themingImports.length > 0) {
      // Check if there's already a @ethlete/cdk import
      const existingCdkImport = modified.match(cdkImportPattern);

      if (existingCdkImport) {
        // Merge imports
        const existingImports = existingCdkImport[1]!
          .split(',')
          .map((imp) => imp.trim())
          .filter((imp) => imp.length > 0);

        const allImports = [...existingImports, ...themingImports.flat()];
        const uniqueImports = Array.from(new Set(allImports));

        // Replace the existing @ethlete/cdk import with merged imports
        modified = modified.replace(cdkImportPattern, `import { ${uniqueImports.join(', ')} } from '@ethlete/cdk'`);

        // Remove all @ethlete/theming imports
        modified = modified.replace(/import\s*{[^}]*}\s*from\s*['"]@ethlete\/theming['"];?\s*\n?/g, '');

        importsMerged++;
        fileChanges++;
      } else {
        // No existing @ethlete/cdk import, just replace @ethlete/theming with @ethlete/cdk
        const importPattern = /from\s+['"]@ethlete\/theming['"]/g;
        const beforeImportCount = (modified.match(importPattern) || []).length;
        modified = modified.replace(importPattern, "from '@ethlete/cdk'");
        fileChanges += beforeImportCount;
        importsMoved += beforeImportCount;
      }
    }

    if (modified !== content) {
      tree.write(filePath, modified);
      filesModified++;
      console.log(`   ✓ ${filePath} (${fileChanges} change${fileChanges !== 1 ? 's' : ''})`);
    }
  });

  // Remove @ethlete/theming from package.json files
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

      // Remove from dependencies
      if (packageJson.dependencies && packageJson.dependencies['@ethlete/theming']) {
        delete packageJson.dependencies['@ethlete/theming'];
        modified = true;
        console.log(`   ✓ Removed @ethlete/theming from ${packageJsonPath} dependencies`);
      }

      // Remove from devDependencies
      if (packageJson.devDependencies && packageJson.devDependencies['@ethlete/theming']) {
        delete packageJson.devDependencies['@ethlete/theming'];
        modified = true;
        console.log(`   ✓ Removed @ethlete/theming from ${packageJsonPath} devDependencies`);
      }

      // Remove from peerDependencies
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
