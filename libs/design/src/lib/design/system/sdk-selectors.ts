import postcss, { Rule } from 'postcss';
import selectorParser, { Node, Pseudo, Selector } from 'postcss-selector-parser';

export type SelectorAttribute = { name: string; operator: string | null; value: string | null };

/**
 * One compound selector of a stylesheet rule that names an `et-` class. `attributes` are the compound's own attribute
 * conditions; `mentioned` adds the ones inside its `:is()`, `:where()` and `:not()`.
 */
export type SdkCompound = {
  classes: string[];
  tag: string | null;
  attributes: SelectorAttribute[];
  mentioned: SelectorAttribute[];
  line: number;
};

type Compound = Omit<SdkCompound, 'line'> & { nested: boolean };

const SAME_ELEMENT_PSEUDOS = new Set([':is', ':where', ':matches', ':not']);

const attributeOf = (node: selectorParser.Attribute): SelectorAttribute => ({
  name: node.attribute.toLowerCase(),
  operator: node.operator ?? null,
  value: node.value ?? null,
});

const emptyCompound = (): Compound => ({ classes: [], tag: null, attributes: [], mentioned: [], nested: false });

const hasCombinator = (selector: Selector) => selector.nodes.some((node) => node.type === 'combinator');

const addInner = (compound: Compound, pseudo: Pseudo) => {
  for (const inner of pseudo.nodes) {
    if (hasCombinator(inner)) continue;

    for (const node of inner.nodes) {
      if (node.type === 'class' && pseudo.value !== ':not') compound.classes.push(node.value);
      else if (node.type === 'attribute') compound.mentioned.push(attributeOf(node));
      else if (node.type === 'pseudo' && SAME_ELEMENT_PSEUDOS.has(node.value)) addInner(compound, node);
    }
  }
};

const compoundsOfSelector = (selector: Selector): Compound[] => {
  const compounds: Compound[] = [emptyCompound()];

  for (const node of selector.nodes as Node[]) {
    const current = compounds[compounds.length - 1] as Compound;

    if (node.type === 'combinator') compounds.push(emptyCompound());
    else if (node.type === 'class') current.classes.push(node.value);
    else if (node.type === 'tag') current.tag = node.value.toLowerCase();
    else if (node.type === 'nesting') current.nested = true;
    else if (node.type === 'attribute') {
      current.attributes.push(attributeOf(node));
      current.mentioned.push(attributeOf(node));
    } else if (node.type === 'pseudo' && SAME_ELEMENT_PSEUDOS.has(node.value)) addInner(current, node);
  }

  return compounds;
};

const merged = (outer: Compound, inner: Compound): Compound => ({
  classes: [...outer.classes, ...inner.classes],
  tag: inner.tag ?? outer.tag,
  attributes: [...outer.attributes, ...inner.attributes],
  mentioned: [...outer.mentioned, ...inner.mentioned],
  nested: false,
});

const parentRuleOf = (rule: Rule): Rule | undefined => {
  let parent: postcss.Node | undefined = rule.parent;

  while (parent && parent.type !== 'rule') parent = parent.parent;

  return parent?.type === 'rule' ? (parent as Rule) : undefined;
};

const selectorsOf = (rule: Rule): Selector[] => {
  try {
    return selectorParser().astSync(rule.selector).nodes;
  } catch {
    return [];
  }
};

const chainsOf = (rule: Rule, seen: Map<Rule, Compound[][]>): Compound[][] => {
  const known = seen.get(rule);

  if (known) return known;

  const parent = parentRuleOf(rule);
  const outer = parent ? chainsOf(parent, seen) : [[]];
  const chains = selectorsOf(rule).flatMap((selector) => {
    const own = compoundsOfSelector(selector);

    return outer.map((chain) => {
      const last = chain[chain.length - 1];
      const nestedAt = own.findIndex((compound) => compound.nested);

      if (nestedAt === -1 || last === undefined) return [...chain, ...own];

      return [
        ...own.slice(0, nestedAt),
        ...chain.slice(0, -1),
        merged(last, own[nestedAt] as Compound),
        ...own.slice(nestedAt + 1),
      ];
    });
  });

  seen.set(rule, chains);

  return chains;
};

/** Each compound selector of `css` that names an `et-` class, with nested rules resolved against their parents. */
export const sdkCompoundsOf = (css: string): SdkCompound[] => {
  let root: postcss.Root;

  try {
    root = postcss.parse(css);
  } catch {
    return [];
  }

  const seen = new Map<Rule, Compound[][]>();
  const compounds: SdkCompound[] = [];

  root.walkRules((rule) => {
    for (let ancestor: postcss.Node | undefined = rule.parent; ancestor; ancestor = ancestor.parent)
      if (ancestor.type === 'atrule' && /keyframes$/u.test((ancestor as postcss.AtRule).name)) return;

    const parent = parentRuleOf(rule);
    const inherited = new Set(parent ? chainsOf(parent, seen).flat() : []);

    for (const chain of chainsOf(rule, seen))
      for (const compound of chain) {
        const { classes, tag, attributes, mentioned } = compound;

        if (!inherited.has(compound) && classes.some((name) => name.startsWith('et-')))
          compounds.push({ classes, tag, attributes, mentioned, line: rule.source?.start?.line ?? 0 });
      }
  });

  return compounds;
};
