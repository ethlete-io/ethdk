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

  function walkFiles(path: string) {
    const entries = tree.children(path);

    entries.forEach((entry) => {
      const fullPath = `${path}/${entry}`.replace(/^\//, '');

      if (tree.isFile(fullPath)) {
        if (fullPath.endsWith('.ts') && !fullPath.endsWith('.spec.ts')) {
          migrateFile(fullPath);
        }
      } else {
        walkFiles(fullPath);
      }
    });
  }

  walkFiles('.');

  function migrateFile(filePath: string) {
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
}
