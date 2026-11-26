import postcss, { Plugin, Root } from 'postcss';
import selectorParser, { Pseudo } from 'postcss-selector-parser';

/** The interactions a part can declare in `definePart({ interactions })`. Rest is always implied. */
export const INTERACTIONS = ['hover', 'focus-visible', 'active', 'disabled'] as const;

export type Interaction = (typeof INTERACTIONS)[number];

export const FORCE_ATTRIBUTE = 'data-et-force';

const FORCED_PSEUDOS = new Set([':hover', ':focus-visible', ':active', ':focus-within']);

const MAY_FORCE = /:(?:hover|focus-visible|active|focus-within)/iu;

const isForcedAlready = (pseudo: Pseudo) => {
  const wrapper = pseudo.parent?.parent;

  if (!wrapper || wrapper.type !== 'pseudo' || wrapper.value.toLowerCase() !== ':is') return false;

  let forced = false;

  wrapper.walkAttributes((attribute) => {
    if (attribute.attribute === FORCE_ATTRIBUTE) forced = true;
  });

  return forced;
};

const forcedPseudoOf = (name: string) =>
  selectorParser().astSync(
    name === 'focus-within'
      ? `:is(:focus-within, :has([${FORCE_ATTRIBUTE}~="focus-visible"]), [${FORCE_ATTRIBUTE}~="focus-visible"])`
      : name === 'hover'
        ? `:is(:hover, [${FORCE_ATTRIBUTE}~="hover"], [${FORCE_ATTRIBUTE}~="active"])`
        : `:is(:${name}, [${FORCE_ATTRIBUTE}~="${name}"])`,
  ).first.first;

const forceSelector = selectorParser((selectors) => {
  const found: Pseudo[] = [];

  selectors.walkPseudos((pseudo) => {
    if (FORCED_PSEUDOS.has(pseudo.value.toLowerCase()) && !isForcedAlready(pseudo)) found.push(pseudo);
  });

  for (const pseudo of found) pseudo.replaceWith(forcedPseudoOf(pseudo.value.slice(1).toLowerCase()));
});

/** One selector with its interaction pseudos rewritten as {@link forceInteractions} rewrites a stylesheet. */
export const forcedSelectorOf = (selector: string) => {
  try {
    return forceSelector.processSync(selector);
  } catch {
    return selector;
  }
};

const forceRoot = (root: Root) => {
  root.walkRules((rule) => {
    if (!MAY_FORCE.test(rule.selector)) return;

    rule.selector = forcedSelectorOf(rule.selector);
  });
};

const FORCED_HELD = 4096;

const forced = new Map<string, string>();

const forcedCssOf = (css: string) => {
  try {
    const root = postcss.parse(css);

    forceRoot(root);

    return root.toString();
  } catch {
    return css;
  }
};

/**
 * Rewrites every `:hover`, `:focus-visible` and `:active` in the selectors of a stylesheet to
 * `:is(<pseudo>, [data-et-force~="<name>"])`, so a frame can force the interaction with the
 * attribute. `:focus-within` also matches an element that is, or has a descendant that is,
 * forced to `focus-visible`, and `:hover` also matches one forced to `active`, as a pointer press hovers. Safe to run again on its own output; CSS it cannot parse comes back unchanged.
 */
export const forceInteractions = (css: string) => {
  if (!MAY_FORCE.test(css)) return css;

  const known = forced.get(css);

  if (known !== undefined) return known;
  if (forced.size >= FORCED_HELD) forced.clear();

  const rewritten = forcedCssOf(css);

  forced.set(css, rewritten);

  return rewritten;
};

export type StyledRendererFactory = { createRenderer(element: unknown, type: { styles: string[] } | null): unknown };

/**
 * Makes Angular's DOM renderer factory rewrite each component's styles with {@link forceInteractions} in place, once,
 * on the first renderer it creates for that component, so every render after reuses the rewritten styles.
 */
export const forceComponentStyles = (factory: StyledRendererFactory) => {
  const createRenderer = factory.createRenderer;
  const forced = new WeakSet<object>();

  factory.createRenderer = function (element, type) {
    if (type && !forced.has(type)) {
      forced.add(type);
      type.styles = type.styles.map(forceInteractions);
    }

    return createRenderer.call(this, element, type);
  };
};

/** {@link forceInteractions} as a PostCSS plugin, run after every other plugin of the pipeline. */
export const forceInteractionsPlugin = (): Plugin => ({
  postcssPlugin: 'ethlete-force-interactions',
  OnceExit: forceRoot,
});
