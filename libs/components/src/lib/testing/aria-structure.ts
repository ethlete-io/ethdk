/**
 * The roles each composite role may be owned by, per the WAI-ARIA required-owned-elements rules.
 * A role whose owner is not on its list does not compose: assistive tech that walks ownership
 * (rather than reading roles one by one) drops the structure or reports the wrong row and column
 * counts.
 */
export const ARIA_REQUIRED_OWNERS: Record<string, readonly string[]> = {
  row: ['grid', 'table', 'treegrid', 'rowgroup'],
  rowgroup: ['grid', 'table', 'treegrid'],
  rowheader: ['row'],
  columnheader: ['row'],
  gridcell: ['row'],
  cell: ['row'],
  tab: ['tablist'],
};

const CELL_ROLES = ['gridcell', 'cell', 'columnheader', 'rowheader'] as const;

const describeElement = (element: Element) => {
  const classes = element.getAttribute('class')?.trim().split(/\s+/) ?? [];

  return classes.length > 0 ? `${element.localName}.${classes[0]}` : element.localName;
};

/**
 * The element that owns `element` in the accessibility tree: its DOM parent, unless that parent is
 * `presentation`/`none`, whose children the browser re-parents onto the next ancestor. A role-less
 * wrapper is *not* skipped - it is exposed as a generic element, which is exactly why it breaks a
 * required-owned relationship and why marking it presentational fixes it.
 */
export const resolveAriaOwner = (element: Element) => {
  let parent = element.parentElement;

  while (parent) {
    const role = parent.getAttribute('role');

    if (role !== 'presentation' && role !== 'none') {
      return parent;
    }

    parent = parent.parentElement;
  }

  return null;
};

const ownedRoles = (root: Element, roles: readonly string[]) => {
  const selector = roles.map((role) => `[role="${role}"]`).join(',');
  const candidates = [...(root.matches(selector) ? [root] : []), ...root.querySelectorAll(selector)];

  return candidates.filter((candidate) => candidate.closest('[aria-hidden="true"]') === null);
};

/**
 * Asserts that every composite role inside `root` is owned by a role that may own it. Catches the
 * whole family of "the roles are all there but a layout wrapper broke the chain" defects: a `grid`
 * whose `rowgroup` sits behind a transition container, a `gridcell` with no `row` ancestor, a
 * `tab` three generic divs below its `tablist`, a `rowgroup` nested in another `rowgroup`.
 */
export const expectOwnedAriaRoles = (root: Element) => {
  for (const element of ownedRoles(root, Object.keys(ARIA_REQUIRED_OWNERS))) {
    const role = element.getAttribute('role') as string;
    const owners = ARIA_REQUIRED_OWNERS[role] as readonly string[];
    const owner = resolveAriaOwner(element);
    const ownerRole = owner?.getAttribute('role') ?? null;
    const found =
      owner === null
        ? 'nothing'
        : `${describeElement(owner)} (${ownerRole === null ? 'no role' : `role="${ownerRole}"`})`;

    expect(
      ownerRole !== null && owners.includes(ownerRole),
      `role="${role}" on ${describeElement(element)} must be owned by ${owners.join(' or ')}, but its owner is ${found}`,
    ).toBe(true);
  }
};

/**
 * Asserts `grid` really is a grid: it carries a grid-family role, it owns at least one row or row
 * group, and every composite role beneath it is owned by something that may own it.
 */
export const expectAriaGrid = (grid: Element) => {
  const role = grid.getAttribute('role');

  expect(
    role !== null && ['grid', 'table', 'treegrid'].includes(role),
    `expected a grid-family role on ${describeElement(grid)}, found ${role === null ? 'none' : `role="${role}"`}`,
  ).toBe(true);

  expectOwnedAriaRoles(grid);

  const owned = ownedRoles(grid, ['row', 'rowgroup']).filter((element) => resolveAriaOwner(element) === grid);

  expect(owned.length, `role="${role}" on ${describeElement(grid)} owns no row or rowgroup`).toBeGreaterThan(0);
};

/**
 * Asserts `tablist` carries the `tablist` role and owns at least one `tab`, plus the ownership walk
 * for everything beneath it.
 */
export const expectAriaTablist = (tablist: Element) => {
  expect(tablist.getAttribute('role')).toBe('tablist');

  expectOwnedAriaRoles(tablist);

  const owned = ownedRoles(tablist, ['tab']).filter((element) => resolveAriaOwner(element) === tablist);

  expect(owned.length, `role="tablist" on ${describeElement(tablist)} owns no tab`).toBeGreaterThan(0);
};

/**
 * Asserts every row inside `root` owns the same number of cells. A row short of a cell is what
 * makes a screen reader announce the wrong column for every cell after the gap, and it is invisible
 * to a per-element role assertion. Only for a grid whose rows are genuinely uniform.
 */
export const expectUniformCellsPerRow = (root: Element) => {
  const counts = ownedRoles(root, ['row']).map((row) => ({
    row,
    cells: ownedRoles(row, CELL_ROLES).filter((cell) => resolveAriaOwner(cell) === row).length,
  }));

  for (const { row, cells } of counts) {
    expect(
      cells,
      `role="row" on ${describeElement(row)} owns ${cells} cells, the first row owns ${counts[0]?.cells}`,
    ).toBe(counts[0]?.cells);
  }
};
