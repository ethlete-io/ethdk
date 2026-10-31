/** Marks the root element of a control's markup as `data-et-control` and animatable, so the design check can see its transitions. */
export const control = (markup: string, name: string) => {
  const rootTag = /^\s*<[a-zA-Z][^\s/>]*/.exec(markup)?.[0];

  if (!rootTag) {
    throw new Error(`control("${name}"): the markup has no root element.`);
  }

  return `${rootTag} data-et-control="${name}" data-can-animate${markup.slice(rootTag.length)}`;
};
