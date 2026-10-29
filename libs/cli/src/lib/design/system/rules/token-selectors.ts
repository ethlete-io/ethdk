import postcss, { Rule } from 'postcss';
import selectorParser, { Node, Selector } from 'postcss-selector-parser';
import { Problem } from '../problem';
import { partKeyOf, ResolvedProduct, tokenPartsOf } from '../resolve-product';

const sdkNode = (node: Node): boolean => {
  if (node.type === 'class') return node.value.startsWith('et-');
  if (node.type === 'attribute')
    return (
      node.attribute === 'class' &&
      !!node.value?.startsWith('et-') &&
      ['=', '~=', '^=', '*='].includes(node.operator ?? '')
    );
  if (node.type === 'pseudo' && [':is', ':where'].includes(node.value))
    return node.nodes.length > 0 && node.nodes.every((selector) => selector.nodes.some(sdkNode));

  return false;
};

const allowedSelector = (selector: Selector, parentScoped: boolean) => {
  if (selector.nodes.some(sdkNode)) return true;
  if (parentScoped) return true;
  const nodes = selector.nodes.filter((node) => node.type !== 'comment');

  return (
    nodes.length === 1 &&
    nodes.some(
      (node) =>
        (node.type === 'tag' && ['html', 'body'].includes(node.value)) ||
        (node.type === 'pseudo' && node.value === ':root'),
    )
  );
};

const selectorsOf = (rule: Rule) => {
  try {
    return selectorParser().astSync(rule.selector).nodes;
  } catch {
    return [];
  }
};

const parentRuleOf = (rule: Rule): Rule | undefined => {
  let parent: postcss.Node | undefined = rule.parent;
  while (parent && parent.type !== 'rule') parent = parent.parent;
  return parent?.type === 'rule' ? (parent as Rule) : undefined;
};

const sdkScoped = (rule: Rule): boolean => {
  const selectors = selectorsOf(rule);
  const parentRule = parentRuleOf(rule);
  const parent = parentRule ? sdkScoped(parentRule) : false;

  return selectors.length > 0 && selectors.every((selector) => selector.nodes.some(sdkNode) || parent);
};

export const tokenSelectorsOf = (product: ResolvedProduct): Problem[] => {
  const tokens = new Set(tokenPartsOf(product.config));

  return product.parts
    .filter((part) => tokens.has(partKeyOf(part)) && part.css && part.cssSource !== null)
    .flatMap((part) => {
      let root: postcss.Root;
      try {
        root = postcss.parse(part.cssSource ?? '');
      } catch {
        return [];
      }
      const problems: Problem[] = [];
      root.walkRules((rule) => {
        for (let ancestor: postcss.Node | undefined = rule.parent; ancestor; ancestor = ancestor.parent) {
          if (ancestor.type === 'atrule' && /^(?:-\w+-)?keyframes$/u.test((ancestor as postcss.AtRule).name)) return;
        }
        const parentRule = parentRuleOf(rule);
        const parent = parentRule ? sdkScoped(parentRule) : false;
        for (const selector of selectorsOf(rule)) {
          if (!allowedSelector(selector, parent))
            problems.push({
              rule: 'TOKEN-SELECTOR',
              file: part.css ?? part.file,
              message: `${selector.toString().trim()} in a globally loaded token stylesheet may affect other parts`,
            });
        }
      });

      return problems;
    });
};
