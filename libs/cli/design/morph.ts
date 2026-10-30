const keyOf = (node: Node) =>
  node instanceof Element
    ? `${node.nodeName}#${node.id}#${node.getAttribute('data-et-key') ?? ''}`
    : `${node.nodeType}`;

const morphAttributes = (from: Element, to: Element) => {
  for (const { name } of [...from.attributes]) if (!to.hasAttribute(name)) from.removeAttribute(name);

  for (const { name, value } of [...to.attributes])
    if (from.getAttribute(name) !== value) from.setAttribute(name, value);
};

const morphNode = (from: Node, to: Node) => {
  if (from instanceof Element && to instanceof Element) {
    morphAttributes(from, to);
    morphChildren(
      from instanceof HTMLTemplateElement ? from.content : from,
      to instanceof HTMLTemplateElement ? to.content : to,
    );
  } else if (from.nodeValue !== to.nodeValue) {
    from.nodeValue = to.nodeValue;
  }
};

const morphChildren = (from: Node, to: Node) => {
  let cursor = from.firstChild;

  for (const next of [...to.childNodes]) {
    const key = keyOf(next);
    let match: ChildNode | null = cursor;

    while (match && keyOf(match) !== key) match = match.nextSibling;

    if (match) {
      while (cursor && cursor !== match) {
        const removed: ChildNode = cursor;

        cursor = cursor.nextSibling;
        removed.remove();
      }

      morphNode(match, next);
      cursor = match.nextSibling;
    } else {
      from.insertBefore(next, cursor);
    }
  }

  while (cursor) {
    const removed: ChildNode = cursor;

    cursor = cursor.nextSibling;
    removed.remove();
  }
};

/**
 * Turns the children of `root` into `markup` by changing only what differs: attributes, text, and the nodes that
 * appear or go. A node is kept when its tag, `id` and `data-et-key` match one at the same place, so its CSS
 * transitions run and a node that appears gets `@starting-style`.
 */
export const morph = (root: Element, markup: string) => {
  const parsed = root.ownerDocument.createElement('template');

  parsed.innerHTML = markup;
  morphChildren(root, parsed.content);
};
