import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migrateColorThemeVariants from './migrate-color-theme-variants/migration';
import migrateLegacyColorThemes from './migrate-legacy-color-themes/migration';
import migrateRemoveSurfaceInteractive from './migrate-remove-surface-interactive/migration';
import migrateSemanticColorThemeInjects from './migrate-semantic-color-theme-injects/migration';
import migrateSurfaceInteractionSwatch from './migrate-surface-interaction-swatch/migration';
import migrateSurfaceRoles from './migrate-surface-roles/migration';
import migrateThemeTokenNames from './migrate-theme-token-names/migration';

const APP_CONFIG = `import { ApplicationConfig } from '@angular/core';
import { provideColorThemes, provideSurfaceThemes } from '@ethlete/core';
import { COLOR_THEMES, SURFACE_THEMES } from './themes';

export const appConfig: ApplicationConfig = {
  providers: [provideColorThemes(COLOR_THEMES), provideSurfaceThemes(SURFACE_THEMES)],
};
`;

const THEMES = `export const COLOR_THEMES = [
  { name: 'brand', isDefault: true, primary: { default: '10 20 30' } },
  { name: 'brand-on-light', primary: { default: '5 10 15' } },
  { name: 'error', type: 'error', primary: { default: '200 0 0' } },
  { name: 'error-on-light', primary: { default: '150 0 0' } },
];

export const LIGHT = {
  name: 'light',
  type: 'light',
  elevation: 0,
  colorTheme: 'brand-on-light',
  semanticColorThemes: { error: 'error-on-light' },
  interactionColor: {
    default: '115 115 115',
    hover: '64 64 64',
    focus: '64 64 64',
    active: '23 23 23',
    disabled: '180 180 180',
  },
};

export const SURFACE_THEMES = [LIGHT];
`;

const STATUS = `import { Component } from '@angular/core';
import { ColorTheme, injectErrorTheme, injectSuccessTheme, SurfaceInteractiveDirective } from '@ethlete/core';

@Component({
  selector: 'app-status',
  template: \`<button etSurfaceInteractive class="et-surface-interactive hover:bg-et-surface-interaction/9"></button>\`,
  imports: [SurfaceInteractiveDirective],
})
export class StatusComponent {
  protected readonly themes: Record<string, ColorTheme | null> = {
    error: injectErrorTheme(),
    success: injectSuccessTheme(),
  };
}
`;

const ROW_CSS = `.row:hover {
  background: color-mix(in srgb, var(--et-surface-interaction) 8%, transparent);
}
`;

const REMOVED_NAMES = [
  /\bprovideColorThemes\b/,
  /\bcreateThemeStyle\b/,
  /\bcreateTailwind\w*/,
  /\binject(Error|Warning|Success)Theme\b/,
  /\bcolorTheme\s*:/,
  /\bsemanticColorThemes\b/,
  /\bSurfaceInteractiveDirective\b/,
  /\bet-surface-interaction\b/,
  /--et-surface-interaction\b/,
];

const read = (tree: Tree, path: string) => tree.read(path, 'utf-8') ?? '';

describe('theming migration chain', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    for (const app of ['app-a', 'app-b']) {
      tree.write(`apps/${app}/src/app/app.config.ts`, APP_CONFIG);
      tree.write(`apps/${app}/src/app/themes.ts`, THEMES);
      tree.write(`apps/${app}/src/app/status.component.ts`, STATUS);
      tree.write(`apps/${app}/src/app/row.css`, ROW_CSS);
    }
  });

  afterEach(() => vi.restoreAllMocks());

  it('sends the pre-revision state through every migration up to the semantic injects', async () => {
    const options = { skipFormat: true };

    await migrateSurfaceInteractionSwatch(tree, options);
    await migrateLegacyColorThemes(tree, options);
    await migrateColorThemeVariants(tree, options);
    await migrateThemeTokenNames(tree, options);
    await migrateSurfaceRoles(tree, options);
    await migrateRemoveSurfaceInteractive(tree, options);
    await migrateSemanticColorThemeInjects(tree, options);
    await migrateColorThemeVariants(tree, options);
    await migrateLegacyColorThemes(tree, options);

    for (const app of ['app-a', 'app-b']) {
      const config = read(tree, `apps/${app}/src/app/app.config.ts`);
      const themes = read(tree, `apps/${app}/src/app/themes.ts`);
      const status = read(tree, `apps/${app}/src/app/status.component.ts`);
      const css = read(tree, `apps/${app}/src/app/row.css`);

      for (const removed of REMOVED_NAMES) {
        for (const [file, content] of Object.entries({ config, themes, status, css })) {
          expect(content, `${app} ${file} still matches ${removed}`).not.toMatch(removed);
        }
      }

      expect(config).toContain('provideColorThemesWithTailwind4(COLOR_THEMES)');
      expect(themes).toContain('colorThemeVariants');
      expect(status).toContain("injectSemanticColorTheme('error')()");
      expect(status).toContain("injectSemanticColorTheme('success')()");
      expect(css).toContain('--et-surface-tint');
    }
  });
});
