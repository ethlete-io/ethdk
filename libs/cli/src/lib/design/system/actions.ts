export const ACTION_INPUTS = ['click', 'Enter', 'Space'] as const;

export type ActionInput = (typeof ACTION_INPUTS)[number];

const SPACE_ONLY_ROLES = ['switch', 'checkbox', 'radio', 'input-checkbox', 'input-radio'];

/** The inputs that press an element of `key`: a checkable control toggles on Space like a native checkbox, not on Enter. */
export const actionInputsOf = (key: string): readonly ActionInput[] =>
  SPACE_ONLY_ROLES.includes(key.slice(0, key.indexOf(' '))) ? ['click', 'Space'] : ACTION_INPUTS;

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
      const role = element.getAttribute('role') ?? (element.tagName === 'INPUT' ? 'input-' + element.type : implicit[element.tagName] ?? (['DIV', 'SPAN'].includes(element.tagName) || element.tagName.includes('-') ? 'generic' : element.tagName.toLowerCase()));
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

/**
 * A script over a design picture that answers, per `data-et-action-probe`, the embedded parts that draw the element,
 * innermost first: each `data-et-part` root around it whose markup was not passed into it through props, up to `part`.
 */
export const embeddedOwnersScriptOf = (part: string) => `(() => {
  const keysOf = (element, name) => (element.getAttribute(name) ?? '').split(' ').filter(Boolean);
  const owners = {};

  for (const element of document.querySelectorAll('[data-et-action-probe]')) {
    const slotted = keysOf(element, 'data-et-slot');
    const chain = [];

    walk: for (let at = element; at; at = at.parentElement)
      for (const key of keysOf(at, 'data-et-part')) {
        const index = slotted.indexOf(key);

        if (index >= 0) slotted.splice(index, 1);
        else if (key === ${JSON.stringify(part)}) break walk;
        else if (!chain.includes(key)) chain.push(key);
      }

    owners[element.getAttribute('data-et-action-probe')] = chain;
  }

  return owners;
})()`;

/**
 * Where a declared action resolves: an output against the components of the embedded parts that draw the element and
 * of the page; a state against the innermost of those parts that has it, the page last. An embedded part in `settled`
 * already draws that state, so the action names it only when the page has no such state.
 */
export const resolveActionOf = (options: {
  value: string | null;
  owners: { part: string; states: readonly string[] }[];
  page: { part: string; states: readonly string[] };
  settled?: readonly string[];
}): { action: DeclaredAction | string | null; owner: string } => {
  const { value, owners, page, settled = [] } = options;
  const trimmed = value?.trim() ?? '';
  const having = owners.filter((candidate) => candidate.states.includes(trimmed));
  const owner = trimmed.startsWith('emit:')
    ? page
    : (having.find((candidate) => !settled.includes(candidate.part)) ??
      (page.states.includes(trimmed) ? page : (having[0] ?? page)));

  return { action: parseAction(value, owner.states), owner: owner.part };
};

/** Whether a state's `aria-expanded` controls all show already in the drawing a press starts from. */
export const drawsStateAlreadyOf = (options: { expected: Record<string, string>; current: Record<string, string> }) => {
  const keys = Object.keys(options.expected);

  return keys.length > 0 && keys.every((key) => options.current[key] === options.expected[key]);
};

/**
 * The props a press from `start` must reach when it opens the surface state `goal` that `open` clicks open from
 * another state: `start`'s own props with the props that tell `goal` from `open.from`; `null` where `goal` itself is
 * the expected drawing or the opening removes a prop.
 */
export const openedFromOf = (options: {
  goal: string;
  start: string;
  states: Record<string, unknown>;
  open: { from: string } | string | undefined;
}): Record<string, unknown> | null => {
  const { goal, start, states, open } = options;

  if (open === undefined || typeof open === 'string' || start === goal || start === open.from) return null;

  const recordOf = (state: string) => {
    const props = states[state];

    return typeof props === 'object' && props !== null ? (props as Record<string, unknown>) : {};
  };
  const target = recordOf(goal);
  const from = recordOf(open.from);
  const own = recordOf(start);
  const keys = [...new Set([...Object.keys(target), ...Object.keys(from)])].filter(
    (key) => JSON.stringify(target[key]) !== JSON.stringify(from[key]),
  );

  if (keys.length === 0 || keys.some((key) => !(key in target))) return null;
  if (keys.every((key) => JSON.stringify(own[key]) === JSON.stringify(target[key]))) return null;

  return Object.fromEntries(keys.map((key) => [key, target[key]]));
};

/** The element selector of the Angular component `source` declares, or `null` without one. */
export const componentSelectorOf = (source: string) =>
  /@Component\s*\(\s*\{[\s\S]*?\bselector\s*:\s*(['"`])([^'"`]+)\1/u.exec(source)?.[2]?.trim() ?? null;

/**
 * A script that records each output the components under the `selectors` fire in `window.__etEmbeddedEmits`, and
 * answers how many components it listens to; `-1` without `window.ng` (a production build).
 */
export const listenEmbeddedScriptOf = (selectors: string[]) => `(() => {
  window.__etEmbeddedEmits = [];
  if (!window.ng) return -1;
  const listened = new Set();

  for (const host of document.querySelectorAll(${JSON.stringify(selectors.join(', '))})) {
    const component = window.ng.getComponent(host);

    if (!component || listened.has(component)) continue;

    listened.add(component);

    for (const [output, property] of Object.entries(window.ng.getDirectiveMetadata(component)?.outputs ?? {}))
      component[property]?.subscribe?.(() => window.__etEmbeddedEmits.push(output));
  }

  return listened.size;
})()`;

/** The state a key press on an element must reach: the declared state's `-focus-visible` row when the part draws one. */
export const targetStateOf = (options: { state: string; input: ActionInput; states: readonly string[] }) => {
  const { state, input, states } = options;
  const focused = `${state}-focus-visible`;

  return input !== 'click' && states.includes(focused) ? focused : state;
};

/** The design and app elements of one state, paired by key and occurrence. */
export const pairElementsOf = <TDesign extends ActionElement>(options: { design: TDesign[]; app: ActionElement[] }) => {
  const idOf = (element: ActionElement) => `${element.key}#${element.occurrence}`;
  const designs = new Map(options.design.map((element) => [idOf(element), element]));
  const apps = new Set(options.app.map(idOf));

  const roleOf = (element: ActionElement) => element.key.slice(0, element.key.indexOf(' "'));
  const leftOf = <T extends ActionElement>(elements: T[], paired: (element: T) => boolean) => {
    const byRole = new Map<string, T[]>();

    for (const element of elements.filter((candidate) => !paired(candidate)))
      byRole.set(roleOf(element), [...(byRole.get(roleOf(element)) ?? []), element]);

    return byRole;
  };
  const designLeft = leftOf(options.design, (design) => apps.has(idOf(design)));
  const appLeft = leftOf(options.app, (app) => designs.has(idOf(app)));
  const renamed = new Map<ActionElement, TDesign>();

  for (const [role, [app, ...moreApps]] of appLeft) {
    const [design, ...moreDesigns] = designLeft.get(role) ?? [];

    if (app && design && moreApps.length === 0 && moreDesigns.length === 0) renamed.set(app, design);
  }

  const renamedDesigns = new Set(renamed.values());

  return {
    paired: options.app.map((app) => ({ app, design: designs.get(idOf(app)) ?? renamed.get(app) ?? null })),
    missing: options.design.filter(
      (design) => design.action !== null && !apps.has(idOf(design)) && !renamedDesigns.has(design),
    ),
  };
};

/** A script over a design picture that answers, per `data-et-action-probe`, the `data-et-control` names around the element, innermost first. */
export const enclosingControlsScriptOf = () => `(() => {
  const within = {};

  for (const element of document.querySelectorAll('[data-et-action-probe]')) {
    const names = [];

    for (let at = element.closest('[data-et-control]'); at; at = at.parentElement?.closest('[data-et-control]') ?? null)
      names.push(at.getAttribute('data-et-control'));

    within[element.getAttribute('data-et-action-probe')] = names;
  }

  return within;
})()`;

/**
 * Whether a design element without a `data-et-action` is exempt from declaring one, as `design complete` exempts it from
 * ACTION-UNDECLARED: an embedded part draws it, or it sits in a control the part declares with a `part`.
 */
export const exemptFromDeclaringOf = (options: {
  owners: readonly string[];
  within: readonly string[];
  controls: unknown;
}) => {
  const controls = typeof options.controls === 'object' && options.controls !== null ? options.controls : {};

  return (
    options.owners.length > 0 ||
    options.within.some((name) => {
      const declared = (controls as Record<string, unknown>)[name];

      return (
        typeof declared === 'object' && declared !== null && typeof (declared as { part?: unknown }).part === 'string'
      );
    })
  );
};

/** The name a report line gives an element. */
export const elementNameOf = (element: ActionElement) =>
  element.occurrence === 0 ? element.key : `${element.key} (${element.occurrence + 1}.)`;

export type ActionOutcome = {
  emitted: string[];
  prevented: boolean;
  compare: { ok: boolean; detail: string } | null;
  reached?: string | null;
};

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
      : `does not reach state ${target}${outcome.compare === null ? '' : ` (${outcome.compare.detail})`}${outcome.reached ? `; ${outcome.reached}` : ''}`;

  return input !== 'click' && outcome.prevented ? `${missed}; its keydown default was prevented` : missed;
};

/**
 * The parts whose `controls` name `part` as a control's `part`. They own the elements `part` draws and declare their
 * actions, so `part` itself is exempt from declaring them.
 */
export const embeddersOf = (options: { part: string; controls: Record<string, unknown> }) =>
  Object.entries(options.controls)
    .filter(
      ([key, declared]) =>
        key !== options.part &&
        typeof declared === 'object' &&
        declared !== null &&
        Object.values(declared).some(
          (control) =>
            typeof control === 'object' && control !== null && (control as { part?: unknown }).part === options.part,
        ),
    )
    .map(([key]) => key)
    .sort();
