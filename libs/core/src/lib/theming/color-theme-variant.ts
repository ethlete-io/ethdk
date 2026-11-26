import { ColorTheme, SURFACE_COLOR } from './color-theme.util';
import { SurfaceTheme } from './surface-theme.util';

/**
 * The color theme name that draws `chosenName` on `surface`: the surface's `colorThemeVariants` entry for it,
 * else `chosenName` itself. Always pass the chosen accent, never an already swapped one.
 */
export const resolveColorThemeVariant = (
  surface: SurfaceTheme | null | undefined,
  chosenName: string,
  themes: ColorTheme[] | null | undefined,
) => {
  if (!surface || chosenName === SURFACE_COLOR) return chosenName;

  const variants: Partial<Record<string, string>> | undefined = surface.colorThemeVariants;
  const variant = variants?.[chosenName];

  if (variant) return variant;

  const chosen = themes?.find((t) => t.name === chosenName);
  const semantic = chosen?.type ? surface.semanticColorThemes?.[chosen.type] : undefined;

  if (semantic) return semantic;

  if (surface.colorTheme && chosen?.isDefault) return surface.colorTheme;

  return chosenName;
};
