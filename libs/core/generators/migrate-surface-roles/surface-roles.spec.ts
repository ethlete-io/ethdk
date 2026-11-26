import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { migrateSurfaceRolesInFile } from './surface-roles';

const LADDER = `{
    default: '115 115 115',
    hover: '64 64 64',
    focus: '64 64 64',
    active: '23 23 23',
    disabled: '180 180 180',
  }`;

const theme = (interactionColor: string) => `
export const CARD = {
  name: 'card',
  type: 'light',
  elevation: 1,
  interactionColor: ${interactionColor},
  background: '255 255 255',
};
`;

describe('migrateSurfaceRolesInFile', () => {
  describe('theme fields', () => {
    it('splits an inline swatch into the tint and the control text ladder', () => {
      const result = migrateSurfaceRolesInFile('surface-themes.ts', theme(`{ color: ${LADDER} }`));

      expect(result.changed).toBe(true);
      expect(result.content).toContain("tint: '115 115 115',");
      expect(result.content).toContain("controlText: {\n    default: '115 115 115',");
      expect(result.content).not.toContain('interactionColor');
      expect(result.findings).toEqual([]);
    });

    it('removes onColor and inkColor with a notice for each', () => {
      const result = migrateSurfaceRolesInFile(
        'surface-themes.ts',
        theme(`{ color: ${LADDER}, onColor: { default: '255 255 255' }, inkColor: { default: '23 23 23' } }`),
      );

      expect(result.content).not.toMatch(/onColor|inkColor|255 255 255'\s*\}/u);
      expect(result.content).toContain("background: '255 255 255'");
      expect(result.notices.map((notice) => notice.reason)).toEqual([
        expect.stringContaining('onColor'),
        expect.stringContaining('inkColor'),
      ]);
      expect(result.notices[0]?.line).toBe(12);
    });

    it('spreads a shared same-file swatch const and rewrites the const', () => {
      const source = `import { SurfaceInteractionColor, SurfaceTheme } from '@ethlete/core';

const DARK_INTERACTION: SurfaceInteractionColor = {
  color: ${LADDER},
};

export const A: SurfaceTheme = { name: 'a', interactionColor: DARK_INTERACTION, background: '0 0 0' };
export const B: SurfaceTheme = { name: 'b', interactionColor: DARK_INTERACTION, background: '0 0 0' };
`;
      const result = migrateSurfaceRolesInFile('surface-themes.ts', source);

      expect(result.content).toContain("import { SurfaceTheme } from '@ethlete/core';");
      expect(result.content).toContain("const DARK_INTERACTION = {\n  tint: '115 115 115',");
      expect(result.content).toContain("} satisfies Pick<SurfaceTheme, 'tint' | 'controlText'>;");
      expect(result.content.match(/\.\.\.DARK_INTERACTION,/gu)).toHaveLength(2);
      expect(result.content).not.toContain('interactionColor');
    });

    it('keeps a control text map referenced by identifier and reads the tint from it', () => {
      const source = `const LADDER = ${LADDER};\n${theme('{ color: LADDER }')}`;
      const result = migrateSurfaceRolesInFile('surface-themes.ts', source);

      expect(result.content).toContain("tint: '115 115 115',");
      expect(result.content).toContain('controlText: LADDER');
    });

    it('stops with the line when the swatch cannot be resolved', () => {
      const result = migrateSurfaceRolesInFile('surface-themes.ts', theme('IMPORTED'));

      expect(result.changed).toBe(false);
      expect(result.findings).toEqual([expect.objectContaining({ line: 6 })]);
    });

    it.each(['app-a', 'app-b'])('migrates the %s themes without a finding', (app) => {
      const source = readFileSync(
        join(__dirname, `../tailwind-4-surface-theme/__fixtures__/${app}/surface-themes.ts.txt`),
        'utf-8',
      );
      const result = migrateSurfaceRolesInFile('surface-themes.ts', source);

      expect(result.findings).toEqual([]);
      expect(result.content).not.toContain('interactionColor');
      expect(result.content.match(/tint: '/gu)?.length).toBe(source.match(/interactionColor:/gu)?.length);
    });

    it('is idempotent', () => {
      const once = migrateSurfaceRolesInFile('surface-themes.ts', theme(`{ color: ${LADDER} }`)).content;

      expect(migrateSurfaceRolesInFile('surface-themes.ts', once).changed).toBe(false);
    });
  });

  describe('token readers', () => {
    it('renames the base inside color-mix to the tint and the rest to the control text', () => {
      const css = `.a {
  background: color-mix(in srgb, var(--et-surface-interaction) 12%, transparent);
  color: var(--et-surface-interaction);
  border-color: var(--et-surface-interaction-hover);
}`;
      const result = migrateSurfaceRolesInFile('a.css', css);

      expect(result.content).toContain('color-mix(in srgb, var(--et-surface-tint) 12%, transparent)');
      expect(result.content).toContain('color: var(--et-surface-control-text);');
      expect(result.content).toContain('border-color: var(--et-surface-control-text-hover);');
    });

    it('renames the Tailwind surface interaction utilities', () => {
      const html = `<div class="text-et-surface-interaction hover:text-fut-surface-card-interaction-hover"></div>`;
      const result = migrateSurfaceRolesInFile('a.html', html);

      expect(result.content).toContain('text-et-surface-control-text hover:text-fut-surface-card-control-text-hover');
    });

    it('renames a Tailwind fill utility to the tint', () => {
      const ts = `const HOVER_PRESS = 'bg-transparent hover:bg-et-surface-interaction/9 active:bg-et-surface-interaction/15';
  'hover:bg-linear-to-b hover:from-et-surface-interaction/9 hover:via-et-surface-interaction/9 active:to-et-surface-interaction/15';
class="rounded-md px-2 text-small hover:bg-et-surface-interaction"
class="fill-et-surface-interaction/40 ring-et-surface-interaction/20 border-x-et-surface-interaction/10 shadow-fut-surface-card-interaction/30"`;
      const result = migrateSurfaceRolesInFile('a.ts', ts);

      expect(result.content).toContain("'bg-transparent hover:bg-et-surface-tint/9 active:bg-et-surface-tint/15'");
      expect(result.content).toContain(
        "'hover:bg-linear-to-b hover:from-et-surface-tint/9 hover:via-et-surface-tint/9 active:to-et-surface-tint/15'",
      );
      expect(result.content).toContain('hover:bg-et-surface-tint"');
      expect(result.content).toContain(
        'fill-et-surface-tint/40 ring-et-surface-tint/20 border-x-et-surface-tint/10 shadow-fut-surface-card-tint/30',
      );
    });

    it('keeps a solid line or a state utility on the control text', () => {
      const html = `<div class="fill-et-surface-interaction border-et-surface-interaction outline-et-surface-interaction bg-et-surface-interaction-hover"></div>`;
      const result = migrateSurfaceRolesInFile('a.html', html);

      expect(result.content).toContain(
        'fill-et-surface-control-text border-et-surface-control-text outline-et-surface-control-text bg-et-surface-control-text-hover',
      );
    });

    it('leaves on-interaction and interaction-ink readers for a hand fix', () => {
      const css = `.a {\n  color: var(--et-surface-on-interaction);\n  fill: var(--et-surface-interaction-ink-hover);\n}`;
      const result = migrateSurfaceRolesInFile('a.css', css);

      expect(result.changed).toBe(false);
      expect(result.findings.map((finding) => finding.line)).toEqual([2, 3]);
    });

    it('skips a generated theme file', () => {
      const css = `/* Generated by @ethlete/core:tailwind-4-surface-theme */\n:root { --et-surface-interaction: rgb(0 0 0); }`;

      expect(migrateSurfaceRolesInFile('themes.css', css).changed).toBe(false);
    });
  });
});
