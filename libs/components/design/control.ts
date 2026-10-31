/**
 * Marks the root element of a control's markup as `data-et-control` and animatable, so the design check can see its
 * transitions. On markup that is already a control, for example a reused part's render, it renames the control.
 */
export const control = (markup: string, name: string) => {
  const rootTag = /^\s*<[a-zA-Z][^>]*/.exec(markup)?.[0];

  if (!rootTag) {
    throw new Error(`control("${name}"): the markup has no root element.`);
  }

  const tagName = /^\s*<[a-zA-Z][^\s/>]*/.exec(rootTag)?.[0] ?? rootTag;
  const rest = rootTag
    .slice(tagName.length)
    .replace(/\s+data-et-control="[^"]*"/u, '')
    .replace(/\s+data-can-animate="[^"]*"/u, '');

  return `${tagName} data-et-control="${name}" data-can-animate="true"${rest}${markup.slice(rootTag.length)}`;
};
