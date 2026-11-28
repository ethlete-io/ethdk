export const BOX_ATTRIBUTE = 'data-box';

/**
 * A page script returning the markup of the first `selector` element (`inner` without the element itself) with each
 * element's border box, relative to that element, in a `data-box="x:… y:… w:… h:…"` attribute; null without the element.
 * The `also` elements outside it follow its markup, boxed relative to it as well.
 */
export const boxedMarkupScriptOf = (
  selector: string,
  { which, also }: { which: 'inner' | 'outer'; also?: string },
) => `(() => {
  const host = document.querySelector(${JSON.stringify(selector)});

  if (!host) return null;

  const origin = host.getBoundingClientRect();
  const round = (value) => Math.round(value * 10) / 10;
  const boxed = (root) => {
    const copy = root.cloneNode(true);
    const copies = [copy, ...copy.querySelectorAll('*')];

    [root, ...root.querySelectorAll('*')].forEach((element, index) => {
      const box = element.getBoundingClientRect();

      copies[index].setAttribute(
        ${JSON.stringify(BOX_ATTRIBUTE)},
        'x:' + round(box.left - origin.left) + ' y:' + round(box.top - origin.top) + ' w:' + round(box.width) + ' h:' + round(box.height),
      );
    });

    return copy;
  };
  const extra = ${also === undefined ? '[]' : `[...document.querySelectorAll(${JSON.stringify(also)})].filter((element) => !host.contains(element))`};

  return boxed(host).${which === 'inner' ? 'innerHTML' : 'outerHTML'} + extra.map((element) => boxed(element).outerHTML).join('');
})()`;
