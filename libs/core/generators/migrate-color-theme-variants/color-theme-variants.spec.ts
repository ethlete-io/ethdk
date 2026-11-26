import { collectColorThemesInFile, FoundColorTheme, migrateColorThemeVariantsInFile } from './color-theme-variants';

const THEMES: FoundColorTheme[] = [
  { name: 'brand', isDefault: true },
  { name: 'brand-on-light', isDefault: false },
  { name: 'success', type: 'success', isDefault: false },
  { name: 'success-on-light', isDefault: false },
];

const migrate = (source: string, themes = THEMES) =>
  migrateColorThemeVariantsInFile('surface-themes.ts', source, themes);

describe('collectColorThemesInFile', () => {
  it('finds color themes with their type and default flag', () => {
    const source = `
export const THEMES = [
  { name: 'brand', isDefault: true, primary: SWATCH },
  { name: 'success', type: 'success', primary: SWATCH },
];
export const LIGHT = { name: 'light', type: 'light', elevation: 0 };
`;

    expect(collectColorThemesInFile('color-themes.ts', source)).toEqual([
      { name: 'brand', type: undefined, isDefault: true },
      { name: 'success', type: 'success', isDefault: false },
    ]);
  });
});

describe('migrateColorThemeVariantsInFile', () => {
  it('keys colorTheme by the default color theme', () => {
    const result = migrate(`export const LIGHT = { name: 'light', elevation: 0, colorTheme: 'brand-on-light' };`);

    expect(result.content).toBe(
      `export const LIGHT = { name: 'light', elevation: 0, colorThemeVariants: { brand: 'brand-on-light' } };`,
    );
    expect(result.unresolved).toEqual([]);
  });

  it('keys semanticColorThemes by the theme of each type', () => {
    const result = migrate(
      `export const LIGHT = { name: 'light', elevation: 0, colorTheme: 'brand-on-light', semanticColorThemes: { success: 'success-on-light' } };`,
    );

    expect(result.content).toBe(
      `export const LIGHT = { name: 'light', elevation: 0, colorThemeVariants: { success: 'success-on-light', brand: 'brand-on-light' } };`,
    );
  });

  it('removes a colorTheme that repeats the default theme', () => {
    const result = migrate(`export const DARK = { name: 'dark', elevation: 0, colorTheme: 'brand' };`);

    expect(result.content).toBe(`export const DARK = { name: 'dark', elevation: 0 };`);
  });

  it('adds to existing colorThemeVariants and lets their entries win', () => {
    const result = migrate(
      `export const LIGHT = { name: 'light', elevation: 0, colorThemeVariants: { brand: 'brand' }, semanticColorThemes: { success: 'success-on-light' }, colorTheme: 'brand-on-light' };`,
    );

    expect(result.content.replace(/\s+/g, ' ')).toContain(
      `colorThemeVariants: { brand: 'brand', success: 'success-on-light' }`,
    );
    expect(result.content).not.toContain('colorTheme:');
    expect(result.content).not.toContain('semanticColorThemes');
  });

  it('quotes a theme name that is not an identifier', () => {
    const themes = [{ name: 'brand-main', isDefault: true }];
    const result = migrate(
      `export const LIGHT = { name: 'light', elevation: 0, colorTheme: 'brand-on-light' };`,
      themes,
    );

    expect(result.content).toContain(`colorThemeVariants: { 'brand-main': 'brand-on-light' }`);
  });

  it('leaves colorTheme and reports it when there is no single default theme', () => {
    const source = `export const LIGHT = { name: 'light', elevation: 0, colorTheme: 'brand-on-light' };`;
    const result = migrate(source, [
      { name: 'a', isDefault: true },
      { name: 'b', isDefault: true },
    ]);

    expect(result.content).toBe(source);
    expect(result.unresolved).toHaveLength(1);
    expect(result.unresolved[0]).toContain('light');
  });

  it('leaves semanticColorThemes and reports it when no theme has that type', () => {
    const source = `export const LIGHT = { name: 'light', elevation: 0, semanticColorThemes: { error: 'error-on-light' } };`;
    const result = migrate(source);

    expect(result.content).toBe(source);
    expect(result.unresolved).toHaveLength(1);
  });

  it('leaves a value that is not a string literal and reports it', () => {
    const source = `export const LIGHT = { name: 'light', elevation: 0, colorTheme: ACCENT };`;
    const result = migrate(source);

    expect(result.content).toBe(source);
    expect(result.unresolved).toHaveLength(1);
  });

  it('ignores a colorTheme outside a surface theme', () => {
    const source = `export const config = { colorTheme: 'brand-on-light' };`;

    expect(migrate(source)).toEqual({ changed: false, content: source, unresolved: [] });
  });

  it('leaves a migrated file alone', () => {
    const migrated = migrate(
      `export const LIGHT = { name: 'light', elevation: 0, colorTheme: 'brand-on-light' };`,
    ).content;

    expect(migrate(migrated).changed).toBe(false);
  });
});
