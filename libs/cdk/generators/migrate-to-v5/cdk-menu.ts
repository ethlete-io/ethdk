import { Tree } from '@nx/devkit';

const SYMBOL_MAP: Record<string, string> = {
  CdkMenuTrigger: 'MenuTriggerDirective',
  CdkMenuItem: 'MenuItemDirective',
  CdkMenu: 'MenuComponent',
  CdkMenuGroup: 'MenuGroupDirective',
  CdkMenuItemCheckbox: 'MenuCheckboxItemComponent',
  CdkMenuItemRadio: 'MenuRadioItemComponent',
};

const CDK_MENU_SYMBOLS = Object.keys(SYMBOL_MAP);

// These are the et menu symbols that should be consolidated into MenuImports in decorators
const ET_MENU_SYMBOLS = new Set([
  'MenuGroupDirective',
  'MenuCheckboxItemComponent',
  'MenuRadioItemComponent',
  'MenuGroupTitleDirective',
  'MenuItemDirective',
  'MenuTriggerDirective',
  'MenuCheckboxGroupDirective',
  'MenuRadioGroupDirective',
  'MenuComponent',
  'MenuSearchTemplateDirective',
]);

export default async function migrateCdkMenu(tree: Tree) {
  console.log('\n🔄 Migrating from CDK menu to et menu');

  const files = tree.children('.');
  const warnings: Map<string, string[]> = new Map();

  function walkFiles(path: string) {
    const entries = tree.children(path);

    entries.forEach((entry) => {
      const fullPath = `${path}/${entry}`.replace(/^\//, '');

      if (tree.isFile(fullPath)) {
        if (fullPath.endsWith('.ts') && !fullPath.endsWith('.spec.ts')) {
          migrateTypeScriptFile(fullPath);
        } else if (fullPath.endsWith('.html')) {
          migrateHtmlFile(fullPath, warnings);
        }
      } else {
        walkFiles(fullPath);
      }
    });
  }

  walkFiles('.');

  // Print warnings at the end
  if (warnings.size > 0) {
    console.log('\n⚠️  Manual migration required for the following files:');
    warnings.forEach((msgs, file) => {
      console.log(`\n📄 ${file}:`);
      msgs.forEach((msg) => console.log(`   - ${msg}`));
    });
  }

  function migrateTypeScriptFile(filePath: string) {
    let content = tree.read(filePath, 'utf-8');
    if (!content) return;

    const originalContent = content;

    // Find all @ethlete/cdk imports
    const importRegex = /import\s*{([^}]*)}\s*from\s*['"]@ethlete\/cdk['"]/g;
    const imports = Array.from(content.matchAll(importRegex));

    if (imports.length === 0) return;

    // Process imports and build replacement
    let hasMenuSymbols = false;
    let hasMenuImports = false;
    const importedSymbols = new Set<string>();

    imports.forEach((match) => {
      const importList = match[1]!;
      const symbols = importList
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s);

      symbols.forEach((symbol) => {
        importedSymbols.add(symbol);
        if (CDK_MENU_SYMBOLS.includes(symbol)) {
          hasMenuSymbols = true;
        }
        if (symbol === 'MenuImports') {
          hasMenuImports = true;
        }
      });
    });

    if (!hasMenuSymbols && !Array.from(importedSymbols).some((s) => ET_MENU_SYMBOLS.has(s))) return;

    // Handle decorator imports arrays FIRST (before replacing symbols in code)
    const decoratorRegex = /imports\s*:\s*\[([\s\S]*?)\]/g;
    let usesMenuInDecorator = false;
    let menuSymbolsInDecorator = new Set<string>();

    content = content.replace(decoratorRegex, (match) => {
      let hasMenuSymbol = false;
      let result = match;

      // Check for CDK menu symbols
      CDK_MENU_SYMBOLS.forEach((symbol) => {
        if (result.includes(symbol)) {
          hasMenuSymbol = true;
          menuSymbolsInDecorator.add(symbol);
          result = result.replace(new RegExp(`\\b${symbol}\\b`, 'g'), '');
        }
      });

      // Check for et menu symbols
      ET_MENU_SYMBOLS.forEach((symbol) => {
        if (result.includes(symbol)) {
          hasMenuSymbol = true;
          menuSymbolsInDecorator.add(symbol);
          result = result.replace(new RegExp(`\\b${symbol}\\b`, 'g'), '');
        }
      });

      if (hasMenuSymbol) {
        usesMenuInDecorator = true;

        // Extract the array content and clean it up
        const arrayMatch = result.match(/imports\s*:\s*\[([\s\S]*?)\]/);
        if (arrayMatch) {
          let arrayContent = arrayMatch[1]!;

          // Split by comma, trim, filter empty strings
          const items = arrayContent
            .split(',')
            .map((item) => item.trim())
            .filter((item) => item && item !== 'MenuImports');

          // Reconstruct with MenuImports
          if (items.length === 0) {
            result = result.replace(/imports\s*:\s*\[([\s\S]*?)\]/, 'imports: [MenuImports]');
          } else {
            const newContent = `MenuImports, ${items.join(', ')}`;
            result = result.replace(/imports\s*:\s*\[([\s\S]*?)\]/, `imports: [${newContent}]`);
          }
        }
      }

      return result;
    });

    // Replace imports
    content = content.replace(importRegex, (match, importList) => {
      const symbols = importList
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s) as string[];

      const replaced = symbols
        .filter((symbol: string) => !menuSymbolsInDecorator.has(symbol))
        .map((symbol: string) => {
          if (CDK_MENU_SYMBOLS.includes(symbol)) {
            return SYMBOL_MAP[symbol];
          }
          return symbol;
        });

      // Add MenuImports if used in decorator and not already present
      if (usesMenuInDecorator && !replaced.includes('MenuImports')) {
        replaced.push('MenuImports');
      }

      // Deduplicate
      const unique = Array.from(new Set(replaced));

      return `import { ${unique.join(', ')} } from '@ethlete/cdk'`;
    }) as string;

    // Replace symbol usages in code
    CDK_MENU_SYMBOLS.forEach((oldSymbol) => {
      if (importedSymbols.has(oldSymbol) && !menuSymbolsInDecorator.has(oldSymbol)) {
        const newSymbol = SYMBOL_MAP[oldSymbol]!;
        content = content!.replace(new RegExp(`\\b${oldSymbol}\\b`, 'g'), newSymbol);
      }
    });

    if (content !== originalContent) {
      tree.write(filePath, content);
    }
  }

  function migrateHtmlFile(filePath: string, warnings: Map<string, string[]>) {
    let content = tree.read(filePath, 'utf-8');
    if (!content) return;

    const originalContent = content;
    const fileWarnings: string[] = [];

    // 1. Replace [cdkMenuTriggerFor] binding with [etMenuTrigger]
    if (content.includes('[cdkMenuTriggerFor]')) {
      content = content.replace(/\[cdkMenuTriggerFor\]/g, '[etMenuTrigger]');
    }

    const cdkMenuRegex = /<(\w+)([^>]*?)\bcdkMenu\b([^>]*)>/g;
    const matches = Array.from(content.matchAll(cdkMenuRegex));

    if (matches.length > 0) {
      fileWarnings.push(
        `Found ${matches.length} element(s) with cdkMenu directive. ` +
          'Replaced with <et-menu> component. Verify all attributes and bindings are preserved.',
      );

      // Collect replacements for entire elements
      const replacements: { start: number; end: number; replacement: string }[] = [];
      for (const match of matches) {
        const tagName = match[1]!;
        const beforeAttrs = match[2]!;
        const afterAttrs = match[3]!;
        const allAttrs = (beforeAttrs + afterAttrs)
          .replace(/\s+cdkMenu\s+/, ' ')
          .replace(/\bcdkMenu\b/, '')
          .trim();
        const spacer = allAttrs ? ' ' : '';
        const openingStart = match.index!;
        const openingEnd = match.index! + match[0].length;
        let count = 1;
        let pos = openingEnd;
        while (pos < content.length && count > 0) {
          if (content.startsWith(`<${tagName}`, pos)) {
            count++;
          } else if (content.startsWith(`</${tagName}>`, pos)) {
            count--;
            if (count === 0) {
              const closingStart = pos;
              const closingEnd = pos + `</${tagName}>`.length;
              const innerContent = content.slice(openingEnd, closingStart);
              const replacement = `<et-menu${spacer}${allAttrs}>${innerContent}</et-menu>`;
              replacements.push({ start: openingStart, end: closingEnd, replacement });
              break;
            }
          }
          pos++;
        }
      }

      // Replace in reverse order to maintain positions
      replacements.sort((a, b) => b.start - a.start);
      for (const rep of replacements) {
        content = content.slice(0, rep.start) + rep.replacement + content.slice(rep.end);
      }
    }

    // 3. Replace cdkMenuItem directive with etMenuItem
    if (content.includes('cdkMenuItem')) {
      content = content.replace(/\bcdkMenuItem\b/g, 'etMenuItem');
    }

    // 4. Replace cdkMenuItemCheckbox with et-menu-checkbox-item
    if (content.includes('cdkMenuItemCheckbox')) {
      const checkboxRegex = /<(\w+)([^>]*?)\bcdkMenuItemCheckbox\b([^>]*)>([\s\S]*?)<\/\1>/g;
      content = content.replace(checkboxRegex, (match, tagName, beforeAttrs, afterAttrs, inner) => {
        const allAttrs = (beforeAttrs + afterAttrs)
          .replace(/\s+cdkMenuItemCheckbox\s+/, ' ')
          .replace(/\bcdkMenuItemCheckbox\b/, '')
          .trim();
        const spacer = allAttrs ? ' ' : '';
        return `<et-menu-checkbox-item${spacer}${allAttrs}>${inner}</et-menu-checkbox-item>`;
      });
    }

    // 5. Replace cdkMenuItemRadio with et-menu-radio-item and add warning
    if (content.includes('cdkMenuItemRadio')) {
      const radioRegex = /<(\w+)([^>]*?)\bcdkMenuItemRadio\b([^>]*)>([\s\S]*?)<\/\1>/g;
      content = content.replace(radioRegex, (match, tagName, beforeAttrs, afterAttrs, inner) => {
        const allAttrs = (beforeAttrs + afterAttrs)
          .replace(/\s+cdkMenuItemRadio\s+/, ' ')
          .replace(/\bcdkMenuItemRadio\b/, '')
          .trim();
        const spacer = allAttrs ? ' ' : '';
        fileWarnings.push(
          'Manual migration required: Wrap et-menu-radio-item elements in <div etMenuRadioGroup> and add appropriate value attributes.',
        );
        return `<et-menu-radio-item${spacer}${allAttrs} value="TODO">${inner}</et-menu-radio-item>`;
      });
    }

    if (content !== originalContent) {
      tree.write(filePath, content);
    }

    if (fileWarnings.length > 0) {
      if (!warnings.has(filePath)) {
        warnings.set(filePath, []);
      }
      warnings.get(filePath)!.push(...fileWarnings);
    }
  }
}
