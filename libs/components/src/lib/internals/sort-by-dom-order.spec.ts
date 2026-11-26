import { sortByDomOrder } from './dom-order';

describe('sortByDomOrder', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  const appendChildren = (count: number) => {
    const elements: HTMLElement[] = [];

    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      container.appendChild(el);
      elements.push(el);
    }

    return elements;
  };

  it('leaves items already in DOM order unchanged', () => {
    const elements = appendChildren(3);

    expect(sortByDomOrder(elements, (el) => el)).toEqual(elements);
  });

  it('reorders items given out of DOM order', () => {
    const elements = appendChildren(4);
    const shuffled = [elements[2]!, elements[0]!, elements[3]!, elements[1]!];

    expect(sortByDomOrder(shuffled, (el) => el)).toEqual(elements);
  });

  it('resolves each item through getElement rather than sorting by identity', () => {
    const elements = appendChildren(3);
    const items = elements.map((el, index) => ({ el, index })).reverse();

    const sorted = sortByDomOrder(items, (item) => item.el);

    expect(sorted.map((item) => item.index)).toEqual([0, 1, 2]);
  });

  it('does not mutate the input array', () => {
    const elements = appendChildren(3);
    const shuffled = [elements[1]!, elements[0]!, elements[2]!];
    const original = [...shuffled];

    sortByDomOrder(shuffled, (el) => el);

    expect(shuffled).toEqual(original);
  });
});
