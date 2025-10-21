import { Tree, visitNotIgnoredFiles } from '@nx/devkit';
import * as ts from 'typescript';

export function migrateCombobox(tree: Tree) {
  console.log('\n🔄 Migrating <et-combobox> components...');

  let filesModified = 0;
  let propertiesRenamed = 0;

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!filePath.endsWith('.html') && !filePath.endsWith('.component.ts')) {
      return;
    }

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    const newContent = migrateEmptyTextProperty(content, filePath);

    if (newContent !== content) {
      tree.write(filePath, newContent);
      filesModified++;
    }
  });

  function migrateEmptyTextProperty(content: string, filePath: string): string {
    let result = content;
    let filePropertiesRenamed = 0;

    // HTML template files
    if (filePath.endsWith('.html')) {
      // Find all <et-combobox> tags and only replace emptyText within them
      const comboboxRegex = /<et-combobox\s[^>]*>/g;

      result = content.replace(comboboxRegex, (match) => {
        let modified = match;
        let localRenames = 0;

        // Replace [emptyText] with [bodyEmptyText]
        const propertyBindingCount = (modified.match(/\[emptyText\]/g) || []).length;
        modified = modified.replace(/\[emptyText\]/g, '[bodyEmptyText]');
        localRenames += propertyBindingCount;

        // Replace emptyText= with bodyEmptyText= (attribute binding)
        const attributeCount = (modified.match(/(\s)emptyText=/g) || []).length;
        modified = modified.replace(/(\s)emptyText=/g, '$1bodyEmptyText=');
        localRenames += attributeCount;

        if (localRenames > 0) {
          filePropertiesRenamed += localRenames;
        }

        return modified;
      });
    }

    // TypeScript component files (inline templates)
    if (filePath.endsWith('.component.ts')) {
      const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

      const replacements: Array<{ start: number; end: number; replacement: string }> = [];

      function visit(node: ts.Node) {
        // Handle template strings in @Component decorator
        if (ts.isPropertyAssignment(node)) {
          if (
            ts.isIdentifier(node.name) &&
            node.name.text === 'template' &&
            (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))
          ) {
            const templateContent = node.initializer.getText(sourceFile);
            const templateText = templateContent.slice(1, -1); // Remove quotes

            // Only process if template contains et-combobox
            if (templateText.includes('<et-combobox') && templateText.includes('emptyText')) {
              let newTemplate = templateText;
              let localRenames = 0;

              // Find all <et-combobox> tags and only replace emptyText within them
              const comboboxRegex = /<et-combobox\s[^>]*>/g;

              newTemplate = newTemplate.replace(comboboxRegex, (match) => {
                let modified = match;

                // Replace [emptyText] with [bodyEmptyText]
                const propertyBindingCount = (modified.match(/\[emptyText\]/g) || []).length;
                modified = modified.replace(/\[emptyText\]/g, '[bodyEmptyText]');
                localRenames += propertyBindingCount;

                // Replace emptyText= with bodyEmptyText=
                const attributeCount = (modified.match(/(\s)emptyText=/g) || []).length;
                modified = modified.replace(/(\s)emptyText=/g, '$1bodyEmptyText=');
                localRenames += attributeCount;

                return modified;
              });

              if (localRenames > 0) {
                const quote = templateContent[0];
                replacements.push({
                  start: node.initializer.getStart(sourceFile),
                  end: node.initializer.getEnd(),
                  replacement: `${quote}${newTemplate}${quote}`,
                });
                filePropertiesRenamed += localRenames;
              }
            }
          }
        }

        ts.forEachChild(node, visit);
      }

      visit(sourceFile);

      // Apply replacements in reverse order
      if (replacements.length > 0) {
        replacements.sort((a, b) => b.start - a.start);
        for (const { start, end, replacement } of replacements) {
          result = result.slice(0, start) + replacement + result.slice(end);
        }
      }
    }

    if (filePropertiesRenamed > 0) {
      console.log(`   ✓ ${filePath}: renamed ${filePropertiesRenamed} property(ies)`);
      propertiesRenamed += filePropertiesRenamed;
    }

    return result;
  }

  if (filesModified > 0) {
    console.log(
      `\n✅ Migrated ${filesModified} file(s), renamed ${propertiesRenamed} emptyText property(ies) to bodyEmptyText`,
    );
  } else {
    console.log('\n✅ No <et-combobox> components found that need migration');
  }
}
