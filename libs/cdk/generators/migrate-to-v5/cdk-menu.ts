import { Tree } from '@nx/devkit';

// export default async function migrateCdkMenu(tree: Tree) {
//   console.log('\n🔄 Migrating from CDK menu to et menu');

//   // Here we need to update imports and usages.
//   // in html
//   // cdkMenuTriggerFor -> etMenuTriggerFor
//   // <nav cdkMenu> -> <etMenu> (could be any tag not just nav), cdkMenu is a directive etMenu is a component
//   // cdkMenuItem -> etMenuItem

//   // in ts
//   // inside the imports array we should only import "MenuImports" from '@ethlete/cdk'

//   /**
//      * the array contains all the exports from et menu
//      *
//      *   MenuGroupDirective,
//   MenuCheckboxItemComponent,
//   MenuRadioItemComponent,
//   MenuGroupTitleDirective,
//   MenuItemDirective,
//   MenuTriggerDirective,
//   MenuCheckboxGroupDirective,
//   MenuRadioGroupDirective,
//   MenuComponent,
//   MenuSearchTemplateDirective,
//      */

//   // if a import is used on its own we should remove it and add MenuImports (if not already added)

//   // If there are cdk menu things used elsewhere we should update them too
//   // CdkMenuTrigger -> EtMenuTrigger

//   // there are also 2 special cases inside html

//   // cdkMenuItemRadio
//   // <et-menu-radio-item value="TODO"> (existing content) </et-menu-radio-item>

//   // all radios need to be wrapped in
//   // <div etMenuRadioGroup>

//   // same with checkboxes
//   // cdkMenuItemCheckbox -> <et-menu-checkbox-item>
//   // they dont need a wrapper

//   // radio and checkbox cases need to be warned about since they require manual changes

//   // do not forget to migrate other attributes onto their new element if needed
// }

const SYMBOL_MAP: Record<string, string> = {
  CdkMenuTrigger: 'MenuTriggerDirective',
  CdkMenuItem: 'MenuItemDirective',
  CdkMenu: 'MenuComponent',
  CdkMenuGroup: 'MenuGroupDirective',
  CdkMenuItemCheckbox: 'MenuCheckboxItemComponent',
  CdkMenuItemRadio: 'MenuRadioItemComponent',
};

const CDK_MENU_SYMBOLS = Object.keys(SYMBOL_MAP);

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
    const newSymbols = new Set<string>();

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
          newSymbols.add(SYMBOL_MAP[symbol]!);
        } else {
          newSymbols.add(symbol);
        }
        if (symbol === 'MenuImports') {
          hasMenuImports = true;
        }
      });
    });

    if (!hasMenuSymbols) return;

    // Handle decorator imports arrays FIRST (before replacing symbols in code)
    const decoratorRegex = /imports\s*:\s*\[([\s\S]*?)\]/g;
    let usesMenuInDecorator = false;
    let menuSymbolsInDecorator = new Set<string>();

    content = content.replace(decoratorRegex, (match) => {
      let hasMenuSymbol = false;
      let result = match;

      CDK_MENU_SYMBOLS.forEach((symbol) => {
        if (result.includes(symbol)) {
          hasMenuSymbol = true;
          menuSymbolsInDecorator.add(symbol);
          result = result.replace(new RegExp(`\\b${symbol}\\b`, 'g'), '');
        }
      });

      if (hasMenuSymbol) {
        usesMenuInDecorator = true;
        result = result
          .replace(/,\s*,/g, ',')
          .replace(/\[\s*,/, '[')
          .replace(/,\s*\]/, ']');
        result = result.replace(/imports\s*:\s*\[\s*\]/, 'imports: [MenuImports]');
        if (!result.includes('MenuImports')) {
          result = result.replace(/imports\s*:\s*\[\s*([^\]])/, 'imports: [MenuImports, $1');
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
