export type DesignMockShape = { tag: string; classes: string[]; attributes: string[]; children: DesignMockShape[] };

const RELEVANT_ATTRIBUTE = /^(data-|aria-|disabled$|type$|role$|hidden$)/;

const ID_REFERENCE_ATTRIBUTE = /^aria-(labelledby|describedby|controls|activedescendant)$/;

const valueOf = (attribute: Attr) =>
  ID_REFERENCE_ATTRIBUTE.test(attribute.name) ? attribute.value.replace(/\S+/g, 'ref') : attribute.value;

/** The tag, sorted classes, relevant attributes and children of an element - what a design mock must match. */
export const shapeOf = (element: Element): DesignMockShape => ({
  tag: element.tagName.toLowerCase(),
  classes: [...element.classList].sort(),
  attributes: [...element.attributes]
    .filter((attribute) => RELEVANT_ATTRIBUTE.test(attribute.name))
    .map((attribute) => `${attribute.name}=${valueOf(attribute)}`)
    .sort(),
  children: [...element.children].map(shapeOf),
});

/** Parses a mock's HTML and returns the shape of the first element matching `selector`. */
export const mockShapeOf = (html: string, selector: string) => {
  const template = document.createElement('template');
  template.innerHTML = html;

  const drawn = template.content.querySelector(selector);
  if (!drawn) throw new Error(`the mock drew no ${selector}`);

  return shapeOf(drawn);
};
