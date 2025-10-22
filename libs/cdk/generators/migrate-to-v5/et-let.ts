import { Tree, visitNotIgnoredFiles } from '@nx/devkit';
import * as ts from 'typescript';

export function migrateEtLet(tree: Tree) {
  console.log('\n🔄 Migrating *etLet and *ngLet');

  let filesModified = 0;
  let directivesConverted = 0;
  let importsRemoved = 0;

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!filePath.endsWith('.html') && !filePath.endsWith('.component.ts')) {
      return;
    }

    const content = tree.read(filePath, 'utf-8');
    if (!content) return;

    let newContent = content;
    let fileModified = false;

    // Migrate directives in templates
    const templateResult = migrateEtLetDirectives(newContent, filePath);
    if (templateResult.content !== newContent) {
      newContent = templateResult.content;
      directivesConverted += templateResult.convertedCount;
      fileModified = true;
    }

    // Remove imports from TypeScript files
    if (filePath.endsWith('.ts')) {
      const importResult = removeLetDirectiveImports(newContent, filePath);
      if (importResult.content !== newContent) {
        newContent = importResult.content;
        importsRemoved += importResult.removedCount;
        fileModified = true;
      }
    }

    if (fileModified) {
      tree.write(filePath, newContent);
      filesModified++;
    }
  });

  function migrateEtLetDirectives(content: string, filePath: string): { content: string; convertedCount: number } {
    let result = content;
    let converted = 0;

    // Handle HTML template files
    if (filePath.endsWith('.html')) {
      const migration = migrateHtmlTemplate(content, filePath);
      result = migration.content;
      converted = migration.convertedCount;
    }

    // Handle inline templates in TypeScript files
    if (filePath.endsWith('.component.ts')) {
      const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
      const replacements: Array<{ start: number; end: number; replacement: string }> = [];

      function visit(node: ts.Node) {
        if (ts.isPropertyAssignment(node)) {
          if (
            ts.isIdentifier(node.name) &&
            node.name.text === 'template' &&
            (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))
          ) {
            const templateContent = node.initializer.getText(sourceFile);
            const templateText = templateContent.slice(1, -1); // Remove quotes

            if (templateText.includes('*etLet=') || templateText.includes('*ngLet=')) {
              const migration = migrateHtmlTemplate(templateText, filePath);

              if (migration.convertedCount > 0) {
                const quote = templateContent[0];
                replacements.push({
                  start: node.initializer.getStart(sourceFile),
                  end: node.initializer.getEnd(),
                  replacement: `${quote}${migration.content}${quote}`,
                });
                converted += migration.convertedCount;
              }
            }
          }
        }

        ts.forEachChild(node, visit);
      }

      visit(sourceFile);

      if (replacements.length > 0) {
        replacements.sort((a, b) => b.start - a.start);
        for (const { start, end, replacement } of replacements) {
          result = result.slice(0, start) + replacement + result.slice(end);
        }
      }
    }

    if (converted > 0) {
      console.log(`   ✓ ${filePath}: converted ${converted} directive(s)`);
    }

    return { content: result, convertedCount: converted };
  }

  function removeLetDirectiveImports(content: string, filePath: string): { content: string; removedCount: number } {
    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
    const replacements: Array<{ start: number; end: number; replacement: string }> = [];
    let removedCount = 0;

    function visit(node: ts.Node) {
      // Remove from imports array in @Component decorator
      if (ts.isDecorator(node)) {
        const expression = node.expression;
        if (ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)) {
          if (expression.expression.text === 'Component' && expression.arguments.length > 0) {
            const arg = expression.arguments[0]!;
            if (ts.isObjectLiteralExpression(arg)) {
              const importsProperty = arg.properties.find(
                (p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'imports',
              ) as ts.PropertyAssignment | undefined;

              if (importsProperty && ts.isArrayLiteralExpression(importsProperty.initializer)) {
                const importsArray = importsProperty.initializer;
                const filteredElements = importsArray.elements.filter((el) => {
                  if (ts.isIdentifier(el)) {
                    return el.text !== 'LetDirective' && el.text !== 'NgLetDirective';
                  }
                  return true;
                });

                if (filteredElements.length !== importsArray.elements.length) {
                  const removedElements = importsArray.elements.length - filteredElements.length;
                  removedCount += removedElements;

                  if (filteredElements.length === 0) {
                    // Remove entire imports property
                    const propertyStart = importsProperty.getStart(sourceFile);
                    const propertyEnd = importsProperty.getEnd();
                    // Check if there's a comma after
                    const nextChar = content[propertyEnd];
                    const endPos = nextChar === ',' ? propertyEnd + 1 : propertyEnd;
                    replacements.push({
                      start: propertyStart,
                      end: endPos,
                      replacement: '',
                    });
                  } else {
                    // Replace with filtered array
                    const newArray = `imports: [${filteredElements.map((el) => el.getText(sourceFile)).join(', ')}]`;
                    replacements.push({
                      start: importsProperty.getStart(sourceFile),
                      end: importsProperty.getEnd(),
                      replacement: newArray,
                    });
                  }
                }
              }
            }
          }
        }
      }

      // Remove from import statements
      if (ts.isImportDeclaration(node) && node.importClause?.namedBindings) {
        if (ts.isNamedImports(node.importClause.namedBindings)) {
          const elements = node.importClause.namedBindings.elements;
          const filteredElements = elements.filter(
            (el) => el.name.text !== 'LetDirective' && el.name.text !== 'NgLetDirective',
          );

          if (filteredElements.length !== elements.length) {
            const removedElements = elements.length - filteredElements.length;
            removedCount += removedElements;

            if (filteredElements.length === 0) {
              // Remove entire import statement
              const importStart = node.getStart(sourceFile);
              const importEnd = node.getEnd();
              const nextChar = content[importEnd];
              const endPos = nextChar === '\n' ? importEnd + 1 : importEnd;
              replacements.push({
                start: importStart,
                end: endPos,
                replacement: '',
              });
            } else {
              // Replace with filtered imports
              const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;
              const newImport = `import { ${filteredElements.map((el) => el.name.text).join(', ')} } from '${moduleSpecifier}';`;
              replacements.push({
                start: node.getStart(sourceFile),
                end: node.getEnd(),
                replacement: newImport,
              });
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    let result = content;
    if (replacements.length > 0) {
      replacements.sort((a, b) => b.start - a.start);
      for (const { start, end, replacement } of replacements) {
        result = result.slice(0, start) + replacement + result.slice(end);
      }
    }

    if (removedCount > 0) {
      console.log(`   ✓ ${filePath}: removed ${removedCount} directive import(s)`);
    }

    return { content: result, removedCount };
  }

  function migrateHtmlTemplate(html: string, filePath?: string): { content: string; convertedCount: number } {
    const startTime = Date.now();

    let result = html;
    let convertedCount = 0;
    let hasMatches = true;
    let iterations = 0;
    const maxIterations = 10000;
    let lastLogTime = startTime;
    const logInterval = 2000;

    while (hasMatches && iterations < maxIterations) {
      iterations++;

      const currentTime = Date.now();
      if (currentTime - lastLogTime > logInterval) {
        const elapsed = ((currentTime - startTime) / 1000).toFixed(1);
        const fileInfo = filePath ? ` (${filePath})` : '';
        console.log(
          `   ⏳ Processing${fileInfo}: ${convertedCount} directives converted, iteration ${iterations}/${maxIterations}, ${elapsed}s elapsed...`,
        );
        lastLogTime = currentTime;
      }

      const letRegex = /\*(etLet|ngLet)="([\s\S]+?)\s+as\s+(\w+)\s*"/;
      const match = letRegex.exec(result);

      if (!match) {
        hasMatches = false;
        break;
      }

      const directive = match[1]!;
      const rawExpression = match[2]!;
      const expression = rawExpression.replace(/\s+/g, ' ').trim();
      const variable = match[3]!;
      const index = match.index;

      const elementStart = result.lastIndexOf('<', index);
      const elementEnd = result.indexOf('>', index) + 1;

      if (elementStart === -1 || elementEnd === 0) {
        console.warn(`   ⚠️  Could not find element boundaries for directive at index ${index}`);
        break;
      }

      const element = result.substring(elementStart, elementEnd);
      const isNgContainer = element.trim().startsWith('<ng-container');

      const lineStart = result.lastIndexOf('\n', elementStart);
      const indentation =
        lineStart === -1 ? result.substring(0, elementStart) : result.substring(lineStart + 1, elementStart);

      if (isNgContainer) {
        let depth = 1;
        let pos = elementEnd;
        let closingTagIndex = -1;
        const len = result.length;
        let openTagsFound = 0;
        let closeTagsFound = 0;

        while (depth > 0 && pos < len) {
          const char = result[pos];

          if (char === '<') {
            if (pos + 1 < len && result[pos + 1] !== '/') {
              // Check for opening <ng-container tag with proper boundary
              if (pos + 13 <= len && result.substring(pos, pos + 13) === '<ng-container') {
                const nextChar = pos + 13 < len ? result[pos + 13] : '';

                // Must be followed by space, >, newline, tab, or carriage return
                if (
                  nextChar === ' ' ||
                  nextChar === '>' ||
                  nextChar === '\n' ||
                  nextChar === '\r' ||
                  nextChar === '\t'
                ) {
                  // Check if this is a self-closing tag by finding the closing >
                  let tagEnd = result.indexOf('>', pos);
                  if (tagEnd !== -1 && result[tagEnd - 1] === '/') {
                    // Self-closing tag - don't increment depth, just skip past it
                    pos = tagEnd + 1;
                    continue;
                  }

                  depth++;
                  openTagsFound++;
                  pos += 13;
                  continue;
                }
              }
            } else if (pos + 1 < len && result[pos + 1] === '/') {
              // Check for closing tag - must match exactly
              if (pos + 15 <= len && result.substring(pos, pos + 15) === '</ng-container>') {
                depth--;
                closeTagsFound++;
                if (depth === 0) {
                  closingTagIndex = pos;
                  break;
                }
                pos += 15;
                continue;
              }
            }
          }

          pos++;
        }

        if (closingTagIndex === -1) {
          console.warn(
            `   ⚠️  Could not find matching closing tag for ng-container (depth=${depth}) in ${filePath || 'template'}`,
          );
          console.warn(`   Variable: ${variable}, started at position ${elementStart}`);
          console.warn(`   Found ${openTagsFound} opening tags and ${closeTagsFound} closing tags`);
          console.warn(`   Searched from ${elementEnd} to ${pos}, result length: ${len}`);

          // Show a snippet around where we are
          const snippetStart = Math.max(0, pos - 100);
          const snippetEnd = Math.min(len, pos + 100);
          console.warn(`   Context around position ${pos}:`);
          console.warn(`   "${result.substring(snippetStart, snippetEnd).replace(/\n/g, '\\n')}"`);
          break;
        }

        const innerContent = result.substring(elementEnd, closingTagIndex);
        const letStatement = `${indentation}@let ${variable} = ${expression};\n`;
        const replaceStart = lineStart === -1 ? 0 : lineStart + 1;

        const beforeClosingTag = result[closingTagIndex - 1];
        const hasNewlineBeforeClosing = beforeClosingTag === '\n';

        const afterClosingTag = result[closingTagIndex + 15];
        const hasNewlineAfterClosing = afterClosingTag === '\n';

        let replacement = letStatement;

        const trimmedInner = innerContent.trimEnd();
        if (trimmedInner) {
          replacement += trimmedInner;
          if (hasNewlineBeforeClosing) {
            replacement += '\n';
          }
        }

        const skipAfterClosing = hasNewlineAfterClosing ? 16 : 15;

        result = result.substring(0, replaceStart) + replacement + result.substring(closingTagIndex + skipAfterClosing);

        convertedCount++;
      } else {
        const letStatement = `${indentation}@let ${variable} = ${expression};\n`;
        const directivePattern = new RegExp(`\\s*\\*${directive}="[\\s\\S]+?\\s+as\\s+\\w+\\s*"\\s*`, 'g');
        const elementWithoutDirective = element
          .replace(directivePattern, ' ')
          .replace(/\s+>/g, '>')
          .replace(/\s{2,}/g, ' ');

        const replaceStart = lineStart === -1 ? 0 : lineStart + 1;
        result =
          result.substring(0, replaceStart) +
          letStatement +
          indentation +
          elementWithoutDirective +
          result.substring(elementEnd);

        convertedCount++;
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

    if (iterations >= maxIterations) {
      console.warn(
        `   ⚠️  Maximum iterations reached after ${totalTime}s - converted ${convertedCount} directives but may have more remaining`,
      );
    } else if (parseFloat(totalTime) > 5) {
      const fileInfo = filePath ? ` ${filePath}` : '';
      console.log(
        `   ⏱️  Completed${fileInfo} in ${totalTime}s (${iterations} iterations, ${convertedCount} directives)`,
      );
    }

    return { content: result, convertedCount };
  }

  if (filesModified > 0) {
    const messages: string[] = [];
    if (directivesConverted > 0) {
      messages.push(`${directivesConverted} directive(s) converted`);
    }
    if (importsRemoved > 0) {
      messages.push(`${importsRemoved} import(s) removed`);
    }
    console.log(`\n✅ Migrated ${filesModified} file(s): ${messages.join(', ')}`);
  } else {
    console.log('\n✅ No *etLet or *ngLet directives found that need migration');
  }
}
