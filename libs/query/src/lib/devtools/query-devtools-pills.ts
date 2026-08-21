/* eslint-disable ethlete/no-direct-dom-manipulation, ethlete/no-dom-query -- both rules assume a
   component with a Renderer2 and a template. These pills have neither on purpose: see
   `renderPills` below for why they cannot be components. */
import { QueryDevtoolsApiEnv, QueryDevtoolsApiEnvSwitch } from './query-devtools-api-envs';
import { onQueryDevtoolsUiChange, queryDevtoolsPillsAllowed } from './query-devtools-ui';

const HOST_ID = 'et-query-devtools-pill';

/** What the picker writes for "let the application decide", which is the key removed. */
const DEFAULT_VALUE = '';

/** Prefixes a production env's name, so the open dropdown says which option is the real backend. */
const PRODUCTION_MARK = '⚠ ';

/** Holds `1` while the pills are folded into the summary chip. Unwritten reads as folded. */
const COLLAPSED_KEY = 'et-query-devtools-pills-collapsed';

const STYLE = `
  :host {
    --_accent: var(--et-theme-color-primary-solid, #60a5fa);
    --_surface: linear-gradient(135deg, #1f1f23, #2a2a30);
    --_ring: inset 0 0 0 1px rgb(255 255 255 / 0.08);
    --_lift: 0 6px 20px rgb(0 0 0 / 0.35);
    --_control: 24px;

    position: fixed;
    display: flex;
    flex-direction: column;
    /* Stretch, not flex-end: it hands every pill the widest pill's width, so the stack keeps one left
       edge as well as one right edge. */
    align-items: stretch;
    gap: 6px 8px;
    inset-block-end: 64px;
    inset-inline-end: 16px;
    max-inline-size: min(420px, calc(100vw - 32px));
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 13px;
    /* One below the panel and the toggle button (2147483010), so an open panel covers the pill - the
       panel offers the same picker on its Settings tab. Keep the three in step. */
    z-index: 2147483009;
  }

  .pill {
    display: flex;
    align-items: center;
    gap: 8px;
    box-sizing: border-box;
    block-size: 34px;
    padding-inline: 12px 5px;
    border-radius: 999px;
    background: var(--_surface);
    color: #fafafa;
    box-shadow:
      var(--_lift),
      var(--_ring);
  }

  .lead {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 6px;
    overflow: hidden;
  }

  .name {
    color: #8f8f98;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    line-height: 1;
    text-transform: uppercase;
    white-space: nowrap;
  }

  select {
    flex: 1;
    min-inline-size: 0;
    box-sizing: border-box;
    block-size: var(--_control);
    padding-inline: 8px 24px;
    border: none;
    border-radius: 7px;
    appearance: none;
    background-color: rgb(255 255 255 / 0.07);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23a1a1aa' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    background-size: 9px 6px;
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.12);
    color: #fafafa;
    font: inherit;
    font-size: 12px;
    line-height: var(--_control);
    text-overflow: ellipsis;
    cursor: pointer;
  }

  .pill button {
    flex: none;
    box-sizing: border-box;
    block-size: var(--_control);
    padding-inline: 9px;
    border: none;
    border-radius: 7px;
    background: rgb(255 255 255 / 0.07);
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.12);
    color: #d4d4d8;
    font: inherit;
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
  }

  select:hover,
  .pill button:hover {
    background-color: rgb(255 255 255 / 0.13);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--_accent) 60%, transparent);
    color: #fafafa;
  }

  select:focus-visible,
  .pill button:focus-visible,
  .chip:focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: 2px;
  }

  .pill button[data-on] {
    background: color-mix(in srgb, var(--_accent) 20%, transparent);
    box-shadow: inset 0 0 0 1px var(--_accent);
    color: #fafafa;
  }

  /* The popup is painted by the browser, which does not inherit the pill's dark background. */
  option {
    background: #1f1f23;
    color: #fafafa;
  }

  .pill[data-production] {
    background: linear-gradient(135deg, #7f1d1d, #b91c1c);
    color: #fff;
    box-shadow:
      0 6px 22px rgb(239 68 68 / 0.5),
      inset 0 0 0 1px rgb(254 202 202 / 0.7);
  }

  .pill[data-production] .name {
    color: #fee2e2;
  }

  .pill[data-production] .mark {
    flex: none;
    font-size: 14px;
    line-height: 1;
  }

  .pill[data-production] select {
    background-color: rgb(0 0 0 / 0.35);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23fecaca' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    box-shadow: inset 0 0 0 1px rgb(254 202 202 / 0.6);
    text-transform: uppercase;
  }

  .pill[data-production] select:hover {
    background-color: rgb(0 0 0 / 0.5);
    box-shadow: inset 0 0 0 1px #fecaca;
  }

  .pill[data-production] option {
    background: #450a0a;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    align-self: flex-end;
    gap: 8px;
    box-sizing: border-box;
    block-size: 28px;
    max-inline-size: 100%;
    padding-inline: 11px 12px;
    border: none;
    border-radius: 999px;
    background: var(--_surface);
    box-shadow:
      var(--_lift),
      var(--_ring);
    color: #fafafa;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
  }

  .chip:hover {
    box-shadow:
      var(--_lift),
      inset 0 0 0 1px var(--_accent);
  }

  .caret {
    flex: none;
    color: var(--_accent);
    font-size: 8px;
    line-height: 1;
    transition: transform 0.15s ease;
  }

  .values {
    overflow: hidden;
    min-inline-size: 0;
    color: #d4d4d8;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .fold {
    color: #8f8f98;
    font-size: 11px;
    letter-spacing: 0.04em;
  }

  :host([data-collapsed]) .pill,
  :host([data-collapsed]) .fold {
    display: none;
  }

  :host(:not([data-collapsed])) .caret {
    transform: rotate(180deg);
  }

  :host(:not([data-collapsed])) .values {
    display: none;
  }

  /* Subgrid, where it exists: one set of columns for the whole stack, so every picker starts and ends
     on the same edge whatever its provider is called. The flex rules above are the fallback. */
  @supports (grid-template-columns: subgrid) {
    :host {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
    }

    .pill {
      display: grid;
      grid-column: 1 / -1;
      grid-template-columns: subgrid;
    }

    /* Nothing follows the picker on an env pill, so it takes the session pill's button column too. */
    .pill:not([data-auth]) select {
      grid-column: 2 / -1;
    }

    .chip {
      grid-column: 1 / -1;
      justify-self: end;
    }
  }

  /* The whole viewport, so the warning is on screen wherever the reader is looking. Outside the pill's
     flex flow: a fixed child of a fixed host still lays out against the viewport. */
  .frame {
    position: fixed;
    inset: 0;
    box-shadow:
      inset 0 0 0 3px rgb(239 68 68 / 0.85),
      inset 0 0 22px rgb(239 68 68 / 0.25);
    opacity: 0.85;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: no-preference) {
    .pill[data-production] {
      animation: et-qd-api-env-pulse 1.6s ease-in-out infinite;
    }

    .frame {
      animation: et-qd-api-env-frame 1.6s ease-in-out infinite;
    }
  }

  @keyframes et-qd-api-env-pulse {
    0%,
    100% {
      box-shadow:
        0 6px 20px rgb(239 68 68 / 0.35),
        inset 0 0 0 1px rgb(254 202 202 / 0.45);
    }

    50% {
      box-shadow:
        0 6px 30px rgb(239 68 68 / 0.85),
        inset 0 0 0 2px rgb(254 226 226 / 0.95);
    }
  }

  @keyframes et-qd-api-env-frame {
    0%,
    100% {
      opacity: 0.35;
    }

    50% {
      opacity: 1;
    }
  }
`;

type EnvOption = { value: string; label: string; title: string };

/** The env a stored value lands on, which is the switch's own fallback while nothing is stored. */
const resolvedEnvOf = (apiSwitch: QueryDevtoolsApiEnvSwitch, stored: string): QueryDevtoolsApiEnv | undefined =>
  apiSwitch.envs.find((env) => env.id === (stored || apiSwitch.fallback));

const nameOf = (env: QueryDevtoolsApiEnv) => `${env.production ? PRODUCTION_MARK : ''}${env.label ?? env.id}`;

/** The one value a folded switch reads as: the env behind the pick, or a typed URL. */
const summaryOfSwitch = (apiSwitch: QueryDevtoolsApiEnvSwitch, stored: string) => {
  const env = resolvedEnvOf(apiSwitch, stored);

  return env ? nameOf(env) : stored || apiSwitch.name;
};

const summaryOfAuthRow = (row: QueryDevtoolsAuthPillRow) => (row.tabLocal ? `${row.current} · own tab` : row.current);

const readCollapsed = () => {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) !== '0';
  } catch {
    return true;
  }
};

const writeCollapsed = (collapsed: boolean) => {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // ignore (private mode / disabled storage / quota)
  }
};

const optionsOf = (apiSwitch: QueryDevtoolsApiEnvSwitch, stored: string): EnvOption[] => {
  const fallback = apiSwitch.envs.find((env) => env.id === apiSwitch.fallback);
  const options: EnvOption[] = [
    {
      value: DEFAULT_VALUE,
      label: fallback ? `default (${nameOf(fallback)})` : 'default',
      title: `Removes ${apiSwitch.storageKey}, so the app picks for itself`,
    },
  ];

  for (const env of apiSwitch.envs) {
    options.push({ value: env.id, label: nameOf(env), title: env.url ?? env.id });
  }

  // A URL typed into the Settings tab is a value no env carries, and a select cannot show one.
  if (stored !== DEFAULT_VALUE && !apiSwitch.envs.some((env) => env.id === stored)) {
    options.push({ value: stored, label: stored, title: `Typed in: ${stored}` });
  }

  return options;
};

const buildSwitch = (
  doc: Document,
  apiSwitch: QueryDevtoolsApiEnvSwitch,
  stored: string,
  pick: (storageKey: string, value: string | null) => void,
) => {
  const production = resolvedEnvOf(apiSwitch, stored)?.production === true;

  // A div, not a label: a label forwards its own hover to the control it names, so a pointer over the
  // pill's trailing button would light the picker up as well.
  const pill = doc.createElement('div');
  pill.className = 'pill';
  pill.title = production
    ? `${apiSwitch.name} points at production. The data is real. Picking reloads the page.`
    : `${apiSwitch.name} — picking reloads the page`;

  const lead = doc.createElement('span');
  lead.className = 'lead';

  if (production) {
    pill.setAttribute('data-production', '');

    const mark = doc.createElement('span');
    mark.className = 'mark';
    mark.textContent = '⚠';
    mark.setAttribute('aria-hidden', 'true');
    lead.append(mark);
  }

  const name = doc.createElement('span');
  name.className = 'name';
  name.textContent = production ? `${apiSwitch.name} · live` : apiSwitch.name;
  lead.append(name);

  const select = doc.createElement('select');
  select.setAttribute('aria-label', apiSwitch.name);

  for (const option of optionsOf(apiSwitch, stored)) {
    const element = doc.createElement('option');
    element.value = option.value;
    element.textContent = option.label;
    element.title = option.title;
    element.selected = option.value === stored;
    select.append(element);
  }

  select.addEventListener('change', () =>
    pick(apiSwitch.storageKey, select.value === DEFAULT_VALUE ? null : select.value),
  );

  pill.append(lead, select);

  return pill;
};

/** One thing a session picker can be switched to: a stored session, or an account to log in as. */
export type QueryDevtoolsAuthPillOption = {
  value: string;
  label: string;
  title: string;
  selected: boolean;

  /** An account whose credentials nobody has typed in yet. On offer, but not pickable. */
  disabled: boolean;
};

export type QueryDevtoolsAuthPillRow = {
  /** The auth provider's own name, shown in front of the picker. */
  name: string;

  /** What the picker reads while nothing is picked - the live session's label, or `anonymous`. */
  current: string;

  /** Whether this tab holds a session of its own rather than the one its siblings share. */
  tabLocal: boolean;

  options: QueryDevtoolsAuthPillOption[];
  pick: (value: string) => void;
  toggleTabLocal: () => void;
};

type EnvPillState = {
  switches: QueryDevtoolsApiEnvSwitch[];
  read: (storageKey: string) => string | null;
  pick: (storageKey: string, value: string | null) => void;
};

type AuthPillState = { rows: QueryDevtoolsAuthPillRow[] };

let envState: EnvPillState | null = null;
let authState: AuthPillState | null = null;

const buildAuthRow = (doc: Document, row: QueryDevtoolsAuthPillRow) => {
  const pill = doc.createElement('div');
  pill.className = 'pill';
  pill.setAttribute('data-auth', '');
  pill.title = row.tabLocal
    ? `${row.name} holds this tab's own session. The other tabs are on theirs.`
    : `${row.name} - the session every tab of this app shares`;

  const lead = doc.createElement('span');
  lead.className = 'lead';

  const name = doc.createElement('span');
  name.className = 'name';
  name.textContent = row.tabLocal ? `${row.name} · this tab` : row.name;
  lead.append(name);

  const select = doc.createElement('select');
  select.setAttribute('aria-label', `${row.name} session`);

  // Only where the live tokens belong to no stored session: with one selected below, this would read as
  // a second session of the same name.
  if (!row.options.some((option) => option.selected)) {
    const current = doc.createElement('option');

    current.value = '';
    current.textContent = row.current;
    current.selected = true;
    select.append(current);
  }

  for (const option of row.options) {
    const element = doc.createElement('option');
    element.value = option.value;
    element.textContent = option.label;
    element.title = option.title;
    element.selected = option.selected;
    element.disabled = option.disabled;
    select.append(element);
  }

  select.addEventListener('change', () => {
    if (select.value) row.pick(select.value);
  });

  const isolate = doc.createElement('button');
  isolate.type = 'button';
  isolate.textContent = row.tabLocal ? 'rejoin' : 'own tab';
  isolate.title = row.tabLocal
    ? 'Hands this tab back to the session every other tab shares. Reloads the page.'
    : 'Keeps this session in this tab alone, so another tab can be somebody else. Reloads the page.';

  if (row.tabLocal) isolate.setAttribute('data-on', '');

  isolate.addEventListener('click', row.toggleTabLocal);

  pill.append(lead, select, isolate);

  return pill;
};

const buildChip = (doc: Document, values: string[], collapsed: boolean, toggle: () => void) => {
  const chip = doc.createElement('button');
  chip.type = 'button';
  chip.className = 'chip';
  chip.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  chip.title = collapsed ? 'Show the devtools switches' : 'Hide the devtools switches';
  // The visible text says which state the pills are in, not what the click does - hence a name of its own.
  chip.setAttribute('aria-label', chip.title);

  const caret = doc.createElement('span');
  caret.className = 'caret';
  caret.textContent = '▲';
  caret.setAttribute('aria-hidden', 'true');

  const text = doc.createElement('span');
  text.className = 'values';
  text.textContent = values.join(' · ');

  const fold = doc.createElement('span');
  fold.className = 'fold';
  fold.textContent = 'hide';

  chip.append(caret, text, fold);
  chip.addEventListener('click', toggle);

  return chip;
};

const render = (doc: Document) => {
  doc.getElementById(HOST_ID)?.remove();

  const switches = envState?.switches ?? [];
  const rows = authState?.rows ?? [];

  if (!switches.length && !rows.length) return;
  if (!queryDevtoolsPillsAllowed()) return;

  const host = doc.createElement('div');
  host.id = HOST_ID;

  // Shadow DOM is intentional, for the same reason the toggle button uses it: this paints over the
  // host application's page and must be as isolated from its global CSS (resets, Tailwind) as possible.
  const shadow = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = STYLE;
  shadow.append(style);

  const storedOf = (apiSwitch: QueryDevtoolsApiEnvSwitch) => envState?.read(apiSwitch.storageKey) ?? DEFAULT_VALUE;
  const production = switches.some((apiSwitch) => resolvedEnvOf(apiSwitch, storedOf(apiSwitch))?.production === true);

  // A production pick unfolds the pills whatever is stored: the warning is the point of the pill.
  const collapsed = !production && readCollapsed();

  if (collapsed) host.setAttribute('data-collapsed', '');

  for (const row of rows) shadow.append(buildAuthRow(doc, row));

  for (const apiSwitch of switches) {
    shadow.append(
      buildSwitch(doc, apiSwitch, storedOf(apiSwitch), (storageKey, value) => envState?.pick(storageKey, value)),
    );
  }

  if (production) {
    const frame = doc.createElement('div');
    frame.className = 'frame';
    frame.setAttribute('aria-hidden', 'true');
    shadow.append(frame);
  } else {
    const values = [
      ...rows.map(summaryOfAuthRow),
      ...switches.map((apiSwitch) => summaryOfSwitch(apiSwitch, storedOf(apiSwitch))),
    ];

    shadow.append(
      buildChip(doc, values, collapsed, () => {
        writeCollapsed(!collapsed);
        render(doc);
      }),
    );
  }

  doc.body.append(host);
};

/**
 * Paints the devtools' pills straight onto `document.body`, outside any Angular component tree.
 *
 * They cannot be components: an application whose boot is stuck on the backend it was just pointed at -
 * a blocking initial navigation waiting out an auth call that never answers - renders no component at
 * all, and that is exactly when somebody needs to pick a different backend or a different user. Mounted
 * from `setQueryDevtoolsApiEnvs()`, which runs while `provideQueryDevtools()` is being called, the env
 * part of this is on the page before `bootstrapApplication` starts.
 */
const renderPills = () => {
  // Registered here rather than at module scope: a module-scope call would make this module
  // unshakeable, and cost every application that never renders a pill the whole renderer.
  onQueryDevtoolsUiChange(renderPills);

  const doc = globalThis.document as Document | undefined;

  if (!doc) return;

  if (doc.body) render(doc);
  else doc.addEventListener('DOMContentLoaded', () => render(doc), { once: true });
};

/**
 * Declares the API env part of the pill. Called by `setQueryDevtoolsApiEnvs()`.
 * @internal
 */
export const setQueryDevtoolsEnvPills = (state: EnvPillState) => {
  envState = state.switches.length ? state : null;
  renderPills();
};

/**
 * Declares the session part of the pill, which is repainted on every switch, login and logout.
 * @internal
 */
export const setQueryDevtoolsAuthPill = (state: AuthPillState) => {
  authState = state.rows.length ? state : null;
  renderPills();
};
