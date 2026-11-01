export const ACTION_INPUTS = ['click', 'Enter', 'Space'] as const;

export type ActionInput = (typeof ACTION_INPUTS)[number];

/** What a design declares an interactive element does: reach a state of the part, or fire one of its outputs. */
export type DeclaredAction = { kind: 'state'; state: string } | { kind: 'emit'; output: string };

/** The interactive elements the action check presses, in a design picture and in the app. */
export const INTERACTIVE_SELECTOR = [
  'button',
  'a[href]',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  ...[
    'button',
    'link',
    'option',
    'menuitem',
    'menuitemradio',
    'menuitemcheckbox',
    'tab',
    'switch',
    'checkbox',
    'radio',
    'treeitem',
  ].map((role) => `[role="${role}"]`),
  '[tabindex]:not([tabindex^="-"])',
].join(', ');

/** An interactive element of a page: `key` is its role and whitespace-free accessible name, `occurrence` its index among equal keys. */
export type ActionElement = {
  key: string;
  occurrence: number;
  probe: number;
  action: string | null;
  control: string | null;
};

/**
 * A script that lists the visible, enabled interactive elements under the `roots` selectors in document order and marks
 * each with `data-et-action-probe` for a locator.
 */
export const actionScanScriptOf = (roots: string[]) => `(() => {
  const implicit = { BUTTON: 'button', A: 'link', SELECT: 'combobox', TEXTAREA: 'textbox' };
  const seen = new Set();
  const counts = new Map();
  const found = [];
  for (const root of document.querySelectorAll(${JSON.stringify(roots.join(', '))})) {
    for (const element of [root, ...root.querySelectorAll('*')]) {
      if (seen.has(element) || !element.matches(${JSON.stringify(INTERACTIVE_SELECTOR)})) continue;
      seen.add(element);
      if (element.matches(':disabled, [aria-disabled="true"]') || element.closest('[inert], [aria-hidden="true"]')) continue;
      if (element.getClientRects().length === 0) continue;
      const role = element.getAttribute('role') ?? (element.tagName === 'INPUT' ? 'input-' + element.type : implicit[element.tagName] ?? element.tagName.toLowerCase());
      const key = role + ' "' + (element.getAttribute('aria-label') ?? element.textContent ?? '').replace(/\\s+/g, '') + '"';
      const occurrence = counts.get(key) ?? 0;
      counts.set(key, occurrence + 1);
      element.setAttribute('data-et-action-probe', String(found.length));
      found.push({ key, occurrence, probe: found.length, action: element.getAttribute('data-et-action'), control: element.getAttribute('data-et-control') });
    }
  }
  return found;
})()`;

/** Parses a `data-et-action` value; a string names what is wrong with it. */
export const parseAction = (value: string | null, states: readonly string[]): DeclaredAction | string | null => {
  if (value === null) return null;

  const trimmed = value.trim();

  if (trimmed.startsWith('emit:')) {
    const output = trimmed.slice('emit:'.length);

    return /^[A-Za-z_$][\w$-]*$/.test(output) ? { kind: 'emit', output } : `data-et-action="${value}" names no output`;
  }

  return states.includes(trimmed)
    ? { kind: 'state', state: trimmed }
    : `data-et-action="${value}" names no state of the part - its states: ${states.join(', ')}`;
};

/** The state a key press on an element must reach: the declared state's `-focus-visible` row when the part draws one. */
export const targetStateOf = (options: { state: string; input: ActionInput; states: readonly string[] }) => {
  const { state, input, states } = options;
  const focused = `${state}-focus-visible`;

  return input !== 'click' && states.includes(focused) ? focused : state;
};

/** The design and app elements of one state, paired by key and occurrence. */
export const pairElementsOf = (options: { design: ActionElement[]; app: ActionElement[] }) => {
  const idOf = (element: ActionElement) => `${element.key}#${element.occurrence}`;
  const designs = new Map(options.design.map((element) => [idOf(element), element]));
  const apps = new Set(options.app.map(idOf));

  return {
    paired: options.app.map((app) => ({ app, design: designs.get(idOf(app)) ?? null })),
    missing: options.design.filter((design) => design.action !== null && !apps.has(idOf(design))),
  };
};

/** The name a report line gives an element. */
export const elementNameOf = (element: ActionElement) =>
  element.occurrence === 0 ? element.key : `${element.key} (${element.occurrence + 1}.)`;

export type ActionOutcome = { emitted: string[]; prevented: boolean; compare: { ok: boolean; detail: string } | null };

/** Why one input on an element missed its declared action, or `null` when it reached it. */
export const actionFailureOf = (options: {
  action: DeclaredAction;
  target: string;
  input: ActionInput;
  outcome: ActionOutcome;
}): string | null => {
  const { action, target, input, outcome } = options;
  const reached = action.kind === 'emit' ? outcome.emitted.includes(action.output) : outcome.compare?.ok === true;

  if (reached) return null;

  const missed =
    action.kind === 'emit'
      ? `fired no ${action.output} output${outcome.emitted.length > 0 ? ` (fired ${outcome.emitted.join(', ')})` : ''}`
      : `does not reach state ${target}${outcome.compare === null ? '' : ` (${outcome.compare.detail})`}`;

  return input !== 'click' && outcome.prevented ? `${missed}; its keydown default was prevented` : missed;
};
