import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// jsdom drops the component stylesheets whole (`@layer`, nesting), so the source text is the only place the
// token registrations are observable from a spec.
const libRoot = fileURLToPath(import.meta.url).replace(/overlay\/[^/]+$/, '');

const panelStylesheets = [
  'menu/menu.component.css',
  'menu/menu-search-styles.component.css',
  'forms/select/select-panel.component.css',
  'forms/cascader/cascader-panel.component.css',
  'forms/date-time/date-range-presets.component.css',
  'command-palette/command-palette.component.css',
];

const nonInheritingPublicTokens = (path: string) =>
  [...readFileSync(libRoot + path, 'utf8').matchAll(/@property\s+(--et-[\w-]+)\s*\{([^}]*)\}/g)]
    .filter(([, , body]) => !/inherits:\s*true/.test(body ?? ''))
    .map(([, name]) => name);

describe('overlay panel tokens', () => {
  it.each(panelStylesheets)(
    '%s registers every public token as inheriting, so a :root value reaches the detached panel',
    (path) => {
      expect(nonInheritingPublicTokens(path)).toEqual([]);
    },
  );

  it('draws the menu panel corners from --et-menu-border-radius', () => {
    const menuCss = readFileSync(libRoot + 'menu/menu.component.css', 'utf8');

    expect(menuCss).toMatch(/@property --et-menu-border-radius \{[^}]*initial-value: 10px;/);
    expect(menuCss).toMatch(/\.et-menu \{[^}]*border-radius: var\(--et-menu-border-radius\);/);
  });

  it('sets the menu item weight from --et-menu-item-font-weight after the font reset', () => {
    const menuCss = readFileSync(libRoot + 'menu/menu.component.css', 'utf8');

    expect(menuCss).toMatch(/@property --et-menu-item-font-weight \{[^}]*initial-value: 400;/);
    expect(menuCss).toMatch(/font: inherit;\s*font-weight: var\(--et-menu-item-font-weight\);/);
  });
});
