/** The rule a page breaks when it lines up buttons in its own markup instead of embedding a part with a role. */
export const BUTTON_GROUP_RULE = 'BUTTON-GROUP';

const GROUP_ROLES = ['toolbar', 'menubar', 'tablist', 'menu', 'listbox', 'radiogroup', 'group']
  .map((role) => `[role="${role}"]`)
  .join(', ');

/**
 * The statements of the button-group check inside the frame script of `render-check`. They use `root`, `report` and
 * `options.part` of that script. On a page, two or more buttons whose closest shared parent is markup of the page
 * itself, not of an embedded part, sit in no element with a grouping role and stand side by side are reported on
 * that parent. A button embedded as a part of its own counts as the page's; buttons inside a composite part belong to
 * that part, buttons in a projected slot to the app, and buttons stacked one under the other form a list.
 */
export const BUTTON_GROUP_STATEMENTS = `
  if (typeof options.part === 'string' && options.part.startsWith('pages/')) {
    const keysOf = (element, name) => (element.getAttribute(name) ?? '').split(' ').filter(Boolean);
    const ownerOf = (element) => {
      let passed = keysOf(element, 'data-et-slot');
      for (let at = element.closest('[data-et-part]'); at && root.contains(at); at = at.parentElement?.closest('[data-et-part]') ?? null) {
        const owner = keysOf(at, 'data-et-part').find((key) => !passed.includes(key));
        if (owner) return owner;
        passed = keysOf(at, 'data-et-slot');
      }
      return null;
    };
    const isPages = (element) => {
      const owner = ownerOf(element);
      return owner === null || owner === options.part;
    };
    const buttonSelector = 'button, [role="button"]';
    const groups = new Map();
    for (const button of root.querySelectorAll(buttonSelector)) {
      if (button.closest(${JSON.stringify(GROUP_ROLES)}) || button.closest('[hidden], [inert], [aria-hidden="true"], [data-et-projected]')) continue;
      const own = button.closest('[data-et-part]');
      const embedded = own && root.contains(own) && !isPages(own) ? own : null;
      if (embedded && embedded.querySelectorAll(buttonSelector).length > 1) continue;
      let item = embedded ?? button;
      if (!item.parentElement || !isPages(item.parentElement)) continue;
      while (item.parentElement && item.parentElement !== root && item.parentElement.children.length === 1 && isPages(item.parentElement.parentElement ?? root)) item = item.parentElement;
      const row = item.parentElement;
      if (!row || !root.contains(row)) continue;
      groups.set(row, [...(groups.get(row) ?? []), button]);
    }
    const besideEachOther = (a, b) => {
      const one = a.getBoundingClientRect();
      const other = b.getBoundingClientRect();

      return one.top < other.bottom && other.top < one.bottom && (one.right <= other.left || other.right <= one.left);
    };
    for (const [row, buttons] of groups) {
      if (!buttons.some((button, index) => buttons.slice(index + 1).some((other) => besideEachOther(button, other)))) continue;
      const names = buttons.map((button) => (button.getAttribute('aria-label') || button.textContent || '').replace(/\\s+/g, ' ').trim()).filter(Boolean);
      report('${BUTTON_GROUP_RULE}', row, buttons.length + ' buttons' + (names.length ? ' (' + names.join(', ') + ')' : '') + ' line up in the page\\'s own markup - put them in a shared part with a role, such as a toolbar (role="toolbar"), and embed it');
    }
  }
`;
