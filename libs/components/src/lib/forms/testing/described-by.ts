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

/**
 * Asserts that the error region a mounted control renders is what describes it: the region under
 * `root` carries an id, and every `[aria-describedby]` element under `root` names that id and
 * resolves.
 *
 * Pass the mounted host element. Arrange for an error to render first - a control with no error
 * region fails.
 */
export const expectDescribedByPointsAtErrors = (root: Element) => {
  const errors = root.querySelector('.et-form-field-errors, .et-form-support-errors');

  expect(errors, 'the control renders no error region').not.toBeNull();

  const errorId = errors?.id ?? '';

  expect(errorId, 'the rendered error region has no id for aria-describedby to name').toBeTruthy();

  const described = Array.from(root.querySelectorAll('[aria-describedby]'));

  expect(described.length, 'nothing under the control has an aria-describedby').toBeGreaterThan(0);

  for (const element of described) {
    const names = element.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? [];

    expect(names, `aria-describedby "${names.join(' ')}" does not name the error region "${errorId}"`).toContain(
      errorId,
    );
    expectDescribedByResolves(element);
  }
};
