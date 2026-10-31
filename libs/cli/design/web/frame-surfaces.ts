export type FrameSurfaceTheme = { name: string; type: string; elevation: number };

export const AUTO_SURFACE_ATTRIBUTE = 'data-et-auto-surface';
export const SURFACE_INTERACTIVE_ATTRIBUTE = 'data-et-surface-interactive';

const SURFACE_CLASS_PREFIX = 'et-surface--';
const SURFACE_INTERACTIVE_CLASS = 'et-surface-interactive';
const SURFACE_CLASS_SELECTOR = /^\.et-surface--([\w-]+)$/u;

const surfaceVarsOf = (style: CSSStyleDeclaration) => {
  const type = style.getPropertyValue('--et-surface-type').trim();
  const elevation = Number.parseInt(style.getPropertyValue('--et-surface-elevation'), 10);

  return type && Number.isFinite(elevation) ? { type, elevation } : null;
};

const themesOfRules = (rules: CSSRuleList, themes: FrameSurfaceTheme[]) => {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      const surface = surfaceVarsOf(rule.style);
      const names = surface
        ? rule.selectorText
            .split(',')
            .map((selector) => SURFACE_CLASS_SELECTOR.exec(selector.trim())?.[1])
            .filter((name): name is string => name !== undefined)
        : [];
      const registered = names.length > 1 ? names.filter((name) => name !== `default-${surface?.type}`) : names;

      if (surface) registered.forEach((name) => themes.push({ name, ...surface }));
    }

    if ('cssRules' in rule) themesOfRules((rule as CSSGroupingRule).cssRules, themes);
  }

  return themes;
};

const sheetThemes = new WeakMap<CSSStyleSheet, FrameSurfaceTheme[]>();

/**
 * The surface themes the frame's stylesheets register: every `.et-surface--<name>` rule that sets
 * `--et-surface-type` and `--et-surface-elevation`, as the SDK's generated surface theme CSS writes them.
 */
export const registeredSurfaceThemesOf = (document: Document) =>
  Array.from(document.styleSheets).flatMap((sheet) => {
    const known = sheetThemes.get(sheet);

    if (known) return known;

    let themes: FrameSurfaceTheme[];

    try {
      themes = themesOfRules(sheet.cssRules, []);
    } catch {
      // A cross-origin sheet hides its rules.
      return [];
    }

    sheetThemes.set(sheet, themes);

    return themes;
  });

const appliedSurface = new WeakMap<Element, string>();

/**
 * Gives each `[data-et-auto-surface]` under `root` the `et-surface--<name>` class of the theme one elevation above
 * the surface it sits on, with the same type, like `etAutoSurface`. Without such a theme it keeps the parent surface.
 */
export const resolveAutoSurfaces = (root: ParentNode, themes: FrameSurfaceTheme[]) => {
  // Document order resolves an outer auto surface before the ones inside it, which read its class.
  for (const element of Array.from(root.querySelectorAll(`[${AUTO_SURFACE_ATTRIBUTE}]`))) {
    const parent = element.parentElement ? surfaceVarsOf(getComputedStyle(element.parentElement)) : null;
    const name = parent
      ? (themes.find((theme) => theme.type === parent.type && theme.elevation === parent.elevation + 1)?.name ?? null)
      : null;
    const previous = appliedSurface.get(element);

    if (previous !== undefined && previous !== name) element.classList.remove(`${SURFACE_CLASS_PREFIX}${previous}`);

    if (name === null) {
      appliedSurface.delete(element);
      continue;
    }

    appliedSurface.set(element, name);
    if (!element.classList.contains(`${SURFACE_CLASS_PREFIX}${name}`))
      element.classList.add(`${SURFACE_CLASS_PREFIX}${name}`);
  }
};

/**
 * Resolves the surface attributes under `root` now and again after every change of its markup or of the page's
 * stylesheets: auto surfaces by elevation, and `[data-et-surface-interactive]` as `etSurfaceInteractive`, whose CSS
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

    if (root.querySelector(`[${AUTO_SURFACE_ATTRIBUTE}]`))
      resolveAutoSurfaces(root, registeredSurfaceThemesOf(document));
  };

  resolve();

  new MutationObserver(resolve).observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', AUTO_SURFACE_ATTRIBUTE, SURFACE_INTERACTIVE_ATTRIBUTE],
  });
  new MutationObserver(resolve).observe(document.head, { childList: true, subtree: true, characterData: true });

  return resolve;
};
