import { migrateInteractionSwatchInFile } from './interaction-swatch';

describe('migrateInteractionSwatchInFile', () => {
  const FLAT = `
export const CARD = {
  name: 'card',
  type: 'light',
  elevation: 1,
  interactionColor: {
    default: '115 115 115',
    hover: '64 64 64',
    focus: '64 64 64',
    active: '23 23 23',
    disabled: '180 180 180',
  },
  background: '255 255 255',
};
`;

  it('wraps a flat interactionColor map in a color swatch', () => {
    const result = migrateInteractionSwatchInFile('surface-themes.ts', FLAT);

    expect(result.changed).toBe(true);
    expect(result.content).toContain('interactionColor: { color: {');
    expect(result.content).toContain("default: '115 115 115',");
    expect(result.content).toContain("disabled: '180 180 180',");
  });

  it('migrates every theme in a file', () => {
    const result = migrateInteractionSwatchInFile('surface-themes.ts', `${FLAT}\n${FLAT.replace('card', 'sheet')}`);

    expect(result.content.match(/interactionColor: \{ color: \{/g)).toHaveLength(2);
  });

  it('migrates a flat swatch referenced by identifier', () => {
    const source = `
const SHARED_MAP = {
  default: '115 115 115',
  hover: '64 64 64',
  focus: '64 64 64',
  active: '23 23 23',
  disabled: '180 180 180',
};
export const CARD = { name: 'card', interactionColor: SHARED_MAP };
`;

    const result = migrateInteractionSwatchInFile('surface-themes.ts', source);

    expect(result.changed).toBe(true);
    expect(result.content).toContain('const SHARED_MAP = { color: {');
  });

  it('leaves an already migrated swatch alone', () => {
    const migrated = migrateInteractionSwatchInFile('surface-themes.ts', FLAT).content;

    expect(migrateInteractionSwatchInFile('surface-themes.ts', migrated).changed).toBe(false);
  });

  it('leaves a swatch that already carries onColor alone', () => {
    const source = `
export const CARD = {
  name: 'card',
  interactionColor: {
    color: { default: '115 115 115', hover: '64 64 64', focus: '64 64 64', active: '23 23 23', disabled: '180 180 180' },
    onColor: { default: '255 255 255' },
  },
};
`;

    expect(migrateInteractionSwatchInFile('surface-themes.ts', source)).toEqual({ changed: false, content: source });
  });

  it('ignores files without an interactionColor', () => {
    const source = `export const CARD = { name: 'card', background: '255 255 255' };`;

    expect(migrateInteractionSwatchInFile('surface-themes.ts', source)).toEqual({ changed: false, content: source });
  });
});
