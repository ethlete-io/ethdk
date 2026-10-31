export type FrameSurfaceTheme = {
  name: string;
  type: string;
  elevation: number;
  isDefault: boolean;
  colorThemeVariants: Partial<Record<string, string>>;
};
export type FrameColorTheme = { name: string; type: string | null; isDefault: boolean };
export type FrameThemes = { surfaces: FrameSurfaceTheme[]; colors: FrameColorTheme[] };

export const AUTO_SURFACE_ATTRIBUTE = 'data-et-auto-surface';
export const SURFACE_INTERACTIVE_ATTRIBUTE = 'data-et-surface-interactive';
export const SEMANTIC_COLOR_ATTRIBUTE = 'data-et-semantic-color';

const SURFACE_CLASS_PREFIX = 'et-surface--';
const COLOR_CLASS_PREFIX = 'et-color--';
const SURFACE_INTERACTIVE_CLASS = 'et-surface-interactive';
const SURFACE_CLASS_SELECTOR = /^\.et-surface--([\w-]+)$/u;
const COLOR_CLASS_SELECTOR = /^\.et-color--([\w-]+)$/u;
const RESERVED_COLORS = new Set(['default', 'surface']);

const surfaceVarsOf = (style: CSSStyleDeclaration) => {
  const type = style.getPropertyValue('--et-surface-type').trim();
  const elevation = Number.parseInt(style.getPropertyValue('--et-surface-elevation'), 10);

  return type && Number.isFinite(elevation) ? { type, elevation } : null;
};

const colorThemeVariantsOf = (style: CSSStyleDeclaration) =>
  Object.fromEntries(
    style
      .getPropertyValue('--et-surface-color-theme-variants')
      .split(',')
      .map((entry) => entry.trim().split(/\s+/u))
      .filter((pair): pair is [string, string] => pair.length === 2),
  );

const scopeNamesOf = (rule: CSSStyleRule, selector: RegExp) =>
  rule.selectorText
    .split(',')
    .map((part) => selector.exec(part.trim())?.[1])
    .filter((name): name is string => name !== undefined);

const themesOfRules = (rules: CSSRuleList, themes: FrameThemes) => {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      const surface = surfaceVarsOf(rule.style);

      if (surface) {
        const names = scopeNamesOf(rule, SURFACE_CLASS_SELECTOR);
        const isDefault = names.includes(`default-${surface.type}`);
        const registered = names.length > 1 ? names.filter((name) => name !== `default-${surface.type}`) : names;
        const colorThemeVariants = colorThemeVariantsOf(rule.style);

        registered.forEach((name) => themes.surfaces.push({ name, ...surface, isDefault, colorThemeVariants }));
      }

      if (rule.style.getPropertyValue('--et-color-primary')) {
        const names = scopeNamesOf(rule, COLOR_CLASS_SELECTOR);
        const type = rule.style.getPropertyValue('--et-color-theme-type').trim() || null;
        const isDefault = names.includes('default');

        names
          .filter((name) => !RESERVED_COLORS.has(name))
          .forEach((name) => themes.colors.push({ name, type, isDefault }));
      }
    }

    if ('cssRules' in rule) themesOfRules((rule as CSSGroupingRule).cssRules, themes);
  }

  return themes;
};

const sheetThemes = new WeakMap<CSSStyleSheet, FrameThemes>();

/**
 * The surface and colour themes the frame's stylesheets register, as the SDK's generated theme CSS writes them: every
 * `.et-surface--<name>` rule that sets `--et-surface-type` and `--et-surface-elevation` (with its
 * `--et-surface-color-theme-variants`), and every `.et-color--<name>` rule that sets `--et-color-primary` (with its
 * `--et-color-theme-type`).
 */
export const registeredThemesOf = (document: Document): FrameThemes => {
  const all: FrameThemes = { surfaces: [], colors: [] };

  for (const sheet of Array.from(document.styleSheets)) {
    let themes = sheetThemes.get(sheet);

    if (!themes) {
      try {
        themes = themesOfRules(sheet.cssRules, { surfaces: [], colors: [] });
      } catch {
        // A cross-origin sheet hides its rules.
        continue;
      }

      sheetThemes.set(sheet, themes);
    }

    all.surfaces.push(...themes.surfaces);
    all.colors.push(...themes.colors);
  }

  return all;
};

const surfaceThemeOf = (element: Element, themes: FrameSurfaceTheme[]): FrameSurfaceTheme | null => {
  for (let current: Element | null = element; current; current = current.parentElement) {
    for (const className of Array.from(current.classList)) {
      if (!className.startsWith(SURFACE_CLASS_PREFIX)) continue;

      const name = className.slice(SURFACE_CLASS_PREFIX.length);
      const theme = themes.find((candidate) =>
        name.startsWith('default-')
          ? candidate.isDefault && `default-${candidate.type}` === name
          : candidate.name === name,
      );

      if (theme) return theme;
    }
  }

  const vars = surfaceVarsOf(getComputedStyle(element));
  const matches = vars ? themes.filter((theme) => theme.type === vars.type && theme.elevation === vars.elevation) : [];

  return matches.find((theme) => theme.isDefault) ?? matches[0] ?? null;
};

const colorVariantOf = (
  surface: FrameSurfaceTheme | null,
  { chosen, colors }: { chosen: string; colors: FrameColorTheme[] },
) => {
  const variant = surface?.colorThemeVariants[chosen];

  return variant && colors.some((theme) => theme.name === variant) ? variant : chosen;
};

const appliedSurface = new WeakMap<Element, string>();
const appliedColor = new WeakMap<Element, { chosen: string; variant: string }>();

const defaultColorOf = (colors: FrameColorTheme[]) => colors.find((theme) => theme.isDefault)?.name ?? null;

const chosenColorOf = (element: Element | null, colors: FrameColorTheme[]) => {
  for (let current = element; current; current = current.parentElement) {
    const applied = appliedColor.get(current);

    if (applied) return applied.chosen;

    for (const className of Array.from(current.classList)) {
      if (!className.startsWith(COLOR_CLASS_PREFIX)) continue;

      const name = className.slice(COLOR_CLASS_PREFIX.length);

      if (name === 'default') return defaultColorOf(colors);
      if (colors.some((theme) => theme.name === name)) return name;
    }
  }

  return defaultColorOf(colors);
};

const applyColor = (element: Element, color: { chosen: string; variant: string } | null) => {
  const previous = appliedColor.get(element);

  if (previous && previous.variant !== color?.variant)
    element.classList.remove(`${COLOR_CLASS_PREFIX}${previous.variant}`);

  if (!color) {
    appliedColor.delete(element);

    return;
  }

  appliedColor.set(element, color);
  if (!element.classList.contains(`${COLOR_CLASS_PREFIX}${color.variant}`))
    element.classList.add(`${COLOR_CLASS_PREFIX}${color.variant}`);
};

const resolveAutoSurface = (element: Element, themes: FrameSurfaceTheme[]) => {
  const parent = element.parentElement ? surfaceVarsOf(getComputedStyle(element.parentElement)) : null;
  const name = parent
    ? (themes.find((theme) => theme.type === parent.type && theme.elevation === parent.elevation + 1)?.name ?? null)
    : null;
  const previous = appliedSurface.get(element);

  if (previous !== undefined && previous !== name) element.classList.remove(`${SURFACE_CLASS_PREFIX}${previous}`);

  if (name === null) {
    appliedSurface.delete(element);

    return;
  }

  appliedSurface.set(element, name);
  if (!element.classList.contains(`${SURFACE_CLASS_PREFIX}${name}`))
    element.classList.add(`${SURFACE_CLASS_PREFIX}${name}`);
};

const resolveColor = (element: Element, themes: FrameThemes) => {
  const type = element.getAttribute(SEMANTIC_COLOR_ATTRIBUTE);

  if (type) {
    const chosen = themes.colors.find((theme) => theme.type === type)?.name;

    applyColor(
      element,
      chosen
        ? {
            chosen,
            variant: colorVariantOf(surfaceThemeOf(element, themes.surfaces), { chosen, colors: themes.colors }),
          }
        : null,
    );

    return;
  }

  const chosen = element.hasAttribute(AUTO_SURFACE_ATTRIBUTE)
    ? chosenColorOf(element.parentElement, themes.colors)
    : null;

  if (!chosen || !element.parentElement) {
    applyColor(element, null);

    return;
  }

  const variant = colorVariantOf(surfaceThemeOf(element, themes.surfaces), { chosen, colors: themes.colors });
  const inherited = colorVariantOf(surfaceThemeOf(element.parentElement, themes.surfaces), {
    chosen,
    colors: themes.colors,
  });

  applyColor(element, variant === inherited ? null : { chosen, variant });
};

/**
 * Resolves the theming attributes under `root` in document order, outer first: `[data-et-auto-surface]` gets the
 * `et-surface--<name>` class of the theme one elevation above the surface it sits on, with the same type, like
 * `etAutoSurface` (without such a theme it keeps the parent surface), plus the class of that surface's
 * `colorThemeVariants` swap of the inherited accent, like `etProvideSurface`. `[data-et-semantic-color="<type>"]`
 * gets the `et-color--<name>` class of the first colour theme of that type, swapped for its surface, like
 * `injectSemanticColorTheme`; without a theme of that type it gets none.
 */
export const resolveTheming = (root: ParentNode, themes: FrameThemes) => {
  for (const element of Array.from(
    root.querySelectorAll(`[${AUTO_SURFACE_ATTRIBUTE}], [${SEMANTIC_COLOR_ATTRIBUTE}]`),
  )) {
    if (element.hasAttribute(AUTO_SURFACE_ATTRIBUTE)) resolveAutoSurface(element, themes.surfaces);

    resolveColor(element, themes);
  }
};

/**
 * Resolves the theming attributes under `root` now and again after every change of its markup or of the page's
 * stylesheets: auto surfaces and semantic colours as `resolveTheming`, and `[data-et-surface-interactive]` as `etSurfaceInteractive`, whose CSS
 * (`interactiveCss`) goes into the page once. Returns the resolve function.
 */
export const watchSurfaces = (root: HTMLElement, interactiveCss: string) => {
  const document = root.ownerDocument;
  let styled = false;

  const resolve = () => {
    const interactive = Array.from(root.querySelectorAll(`[${SURFACE_INTERACTIVE_ATTRIBUTE}]`));

    interactive.forEach((element) => {
      if (!element.classList.contains(SURFACE_INTERACTIVE_CLASS)) element.classList.add(SURFACE_INTERACTIVE_CLASS);
    });

    if (interactive.length > 0 && !styled) {
      const style = document.createElement('style');

      styled = true;
      style.textContent = interactiveCss;
      document.head.append(style);
    }

    if (root.querySelector(`[${AUTO_SURFACE_ATTRIBUTE}], [${SEMANTIC_COLOR_ATTRIBUTE}]`))
      resolveTheming(root, registeredThemesOf(document));
  };

  resolve();

  new MutationObserver(resolve).observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', AUTO_SURFACE_ATTRIBUTE, SURFACE_INTERACTIVE_ATTRIBUTE, SEMANTIC_COLOR_ATTRIBUTE],
  });
  new MutationObserver(resolve).observe(document.head, { childList: true, subtree: true, characterData: true });

  return resolve;
};
