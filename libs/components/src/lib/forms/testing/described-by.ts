/**
 * Asserts that a control's `aria-describedby` actually resolves: every id it names must exist in
 * the document and carry text. An `aria-describedby` pointing at nothing is silent - the browser
 * reports no description at all, so a hint or error that renders on screen is never announced.
 *
 * Pass the element that carries the attribute (the focusable control, not its wrapper). A control
 * with no `aria-describedby` at all passes - use it where a description is expected, after
 * arranging for one.
 */
export const expectDescribedByResolves = (element: Element) => {
  const describedBy = element.getAttribute('aria-describedby');

  if (describedBy === null) {
    return;
  }

  const root = element.getRootNode() as Document | ShadowRoot;

  for (const id of describedBy.split(/\s+/).filter(Boolean)) {
    const target = root.querySelector(`[id="${id}"]`);

    expect(target, `aria-describedby names "${id}", which is not in the document`).not.toBeNull();
    expect(target?.textContent?.trim(), `the element "${id}" describes with is empty`).toBeTruthy();
  }
};
