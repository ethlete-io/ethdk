import { Tree, visitNotIgnoredFiles } from '@nx/devkit';
import * as ts from 'typescript';

export function migrateEtLet(tree: Tree) {
  console.log('\n🔄 Migrating *etLet and *ngLet');

  let filesModified = 0;
  let directivesConverted = 0;
  let importsRemoved = 0;
  const renamedVariables: Array<{ file: string; original: string; renamed: string; line: number }> = [];

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
      renamedVariables.push(...templateResult.renamedVariables);
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

  function migrateEtLetDirectives(
    content: string,
    filePath: string,
  ): {
    content: string;
    convertedCount: number;
    renamedVariables: Array<{ file: string; original: string; renamed: string; line: number }>;
  } {
    let result = content;
    let converted = 0;
    const renamedVars: Array<{ file: string; original: string; renamed: string; line: number }> = [];

    // Handle HTML template files
    if (filePath.endsWith('.html')) {
      const migration = migrateHtmlTemplate(content, filePath);
      result = migration.content;
      converted = migration.convertedCount;
      renamedVars.push(...migration.renamedVariables);
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
                renamedVars.push(...migration.renamedVariables);
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

    return { content: result, convertedCount: converted, renamedVariables: renamedVars };
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

  function migrateHtmlTemplate(
    html: string,
    filePath?: string,
  ): {
    content: string;
    convertedCount: number;
    renamedVariables: Array<{ file: string; original: string; renamed: string; line: number }>;
  } {
    const startTime = Date.now();

    let result = html;
    let convertedCount = 0;
    let hasMatches = true;
    let iterations = 0;
    const maxIterations = 10000;
    let lastLogTime = startTime;
    const logInterval = 2000;

    // Track variable names to prevent duplicates
    const usedVariables = new Map<string, number>(); // variable name -> count
    const renamedVars: Array<{ file: string; original: string; renamed: string; line: number }> = [];

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
      const originalVariable = match[3]!;
      let variable = originalVariable;
      const index = match.index;

      // Check if this variable name is already used
      if (usedVariables.has(variable)) {
        const count = usedVariables.get(variable)!;
        usedVariables.set(variable, count + 1);
        variable = `${variable}${count + 1}`;

        // Calculate approximate line number
        const lineNumber = result.substring(0, index).split('\n').length;

        renamedVars.push({
          file: filePath || 'inline template',
          original: originalVariable,
          renamed: variable,
          line: lineNumber,
        });
      } else {
        usedVariables.set(variable, 1);
      }

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
              if (pos + 13 <= len && result.substring(pos, pos + 13) === '<ng-container') {
                const nextChar = pos + 13 < len ? result[pos + 13] : '';

                if (
                  nextChar === ' ' ||
                  nextChar === '>' ||
                  nextChar === '\n' ||
                  nextChar === '\r' ||
                  nextChar === '\t'
                ) {
                  // Check if this is a self-closing tag
                  const tagEnd = result.indexOf('>', pos);
                  if (tagEnd !== -1 && result[tagEnd - 1] === '/') {
                    // Self-closing tag - don't increment depth
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
          console.warn(`   ⚠️  Could not find matching closing tag for ng-container in ${filePath || 'template'}`);
          console.warn(`   Variable: ${variable}, started at position ${elementStart}`);
          console.warn(`   Found ${openTagsFound} opening and ${closeTagsFound} closing <ng-container> tags`);
          break;
        }

        let innerContent = result.substring(elementEnd, closingTagIndex);

        // If we renamed the variable, update all references in the inner content
        if (variable !== originalVariable) {
          // Replace in attribute values
          const attributeValuePattern = new RegExp(`(\\[[^\\]]+\\])="([^"]*?)\\b${originalVariable}\\b([^"]*?)"`, 'g');
          innerContent = innerContent.replace(attributeValuePattern, `$1="$2${variable}$3"`);

          // Replace in interpolations like {{variable}}
          const interpolationPattern = new RegExp(`\\{\\{([^}]*?)\\b${originalVariable}\\b([^}]*?)\\}\\}`, 'g');
          innerContent = innerContent.replace(interpolationPattern, `{{$1${variable}$2}}`);

          // Replace in control flow conditions: @if (variable), @for (...; track variable), etc.
          // Match the keyword, optional whitespace, opening paren, content before variable, variable, content after variable, closing paren
          const controlFlowPattern = new RegExp(
            `(@(?:if|for|switch))(\\s*\\()([^)]*?)\\b${originalVariable}\\b([^)]*)\\)`,
            'g',
          );
          innerContent = innerContent.replace(controlFlowPattern, `$1$2$3${variable}$4)`);

          // Replace in [ngClass], [ngStyle] object keys and values
          const ngClassPattern = new RegExp(
            `(\\[ng(?:Class|Style)\\])="\\{([^}]*?)\\b${originalVariable}\\b([^}]*?)\\}"`,
            'g',
          );
          innerContent = innerContent.replace(ngClassPattern, `$1="{$2${variable}$3}"`);
        }

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
        // For non-ng-container elements, we need to find the closing tag and update inner content too
        const elementTagName = element.match(/<(\w+)/)?.[1];
        let closingTag = -1;
        let innerContent = '';

        if (elementTagName) {
          // Find the matching closing tag
          const closingPattern = new RegExp(`</${elementTagName}>`);
          const searchStart = elementEnd;
          const closingMatch = closingPattern.exec(result.substring(searchStart));

          if (closingMatch) {
            closingTag = searchStart + closingMatch.index;
            innerContent = result.substring(elementEnd, closingTag);
          }
        }

        const letStatement = `${indentation}@let ${variable} = ${expression};\n`;

        // Replace the directive pattern
        const directivePattern = new RegExp(`\\s*\\*${directive}="[\\s\\S]+?\\s+as\\s+\\w+\\s*"\\s*`, 'g');
        let elementWithoutDirective = element
          .replace(directivePattern, ' ')
          .replace(/\s+>/g, '>')
          .replace(/\s{2,}/g, ' ');

        // If we renamed the variable, update all references
        if (variable !== originalVariable) {
          // Update references in the element's attributes
          const attributeValuePattern = new RegExp(`(\\[[^\\]]+\\])="([^"]*?)\\b${originalVariable}\\b([^"]*?)"`, 'g');
          elementWithoutDirective = elementWithoutDirective.replace(attributeValuePattern, `$1="$2${variable}$3"`);

          const interpolationPattern = new RegExp(`\\{\\{([^}]*?)\\b${originalVariable}\\b([^}]*?)\\}\\}`, 'g');
          elementWithoutDirective = elementWithoutDirective.replace(interpolationPattern, `{{$1${variable}$2}}`);

          // Update references in inner content
          if (innerContent) {
            // Replace in attribute values
            innerContent = innerContent.replace(attributeValuePattern, `$1="$2${variable}$3"`);

            // Replace in interpolations
            innerContent = innerContent.replace(interpolationPattern, `{{$1${variable}$2}}`);

            // Replace in control flow conditions
            const controlFlowPattern = new RegExp(
              `(@(?:if|for|switch))(\\s*\\()([^)]*?)\\b${originalVariable}\\b([^)]*)\\)`,
              'g',
            );
            innerContent = innerContent.replace(controlFlowPattern, `$1$2$3${variable}$4)`);

            // Replace in [ngClass], [ngStyle] object keys and values
            const ngClassPattern = new RegExp(
              `(\\[ng(?:Class|Style)\\])="\\{([^}]*?)\\b${originalVariable}\\b([^}]*?)\\}"`,
              'g',
            );
            innerContent = innerContent.replace(ngClassPattern, `$1="{$2${variable}$3}"`);
          }
        }

        const replaceStart = lineStart === -1 ? 0 : lineStart + 1;

        if (closingTag !== -1 && elementTagName) {
          // Replace element with directive + element without directive + updated inner content + closing tag
          const afterClosingTag = closingTag + elementTagName.length + 3; // </tagname>
          result =
            result.substring(0, replaceStart) +
            letStatement +
            indentation +
            elementWithoutDirective +
            innerContent +
            `</${elementTagName}>` +
            result.substring(afterClosingTag);
        } else {
          // Fallback for self-closing or elements where we can't find closing tag
          result =
            result.substring(0, replaceStart) +
            letStatement +
            indentation +
            elementWithoutDirective +
            result.substring(elementEnd);
        }

        convertedCount++;
      }
    }

    // Clean up: remove multiple consecutive blank lines after @let statements
    // This groups @let statements together by removing extra blank lines between them
    result = result.replace(/(@let [^;]+;)\n\n+(?=\s*@let)/g, '$1\n');

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

    return { content: result, convertedCount, renamedVariables: renamedVars };
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

    // Warn about renamed variables
    if (renamedVariables.length > 0) {
      console.log(`\n⚠️  Variable name conflicts resolved - please review:`);
      for (const { file, original, renamed, line } of renamedVariables) {
        console.log(`   • ${file}:${line} - "${original}" renamed to "${renamed}"`);
      }
    }
  } else {
    console.log('\n✅ No *etLet or *ngLet directives found that need migration');
  }
}
