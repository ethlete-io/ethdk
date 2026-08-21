/* eslint-disable ethlete/no-direct-dom-manipulation, ethlete/no-dom-query -- both rules assume a
   component with a Renderer2 and a template. These pills have neither on purpose: see
   `renderPills` below for why they cannot be components. */
import { QueryDevtoolsApiEnv, QueryDevtoolsApiEnvSwitch } from './query-devtools-api-envs';

const HOST_ID = 'et-query-devtools-pill';

/** What the picker writes for "let the application decide", which is the key removed. */
const DEFAULT_VALUE = '';

/** Prefixes a production env's name, so the open dropdown says which option is the real backend. */
const PRODUCTION_MARK = '⚠ ';

const STYLE = `
  :host {
    position: fixed;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    inset-block-end: 64px;
    inset-inline-end: 16px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 13px;
    /* One below the panel and the toggle button (2147483010), so an open panel covers the pill - the
       panel offers the same picker on its Settings tab. Keep the three in step. */
    z-index: 2147483009;
  }

  label {
    --_accent: var(--et-theme-color-primary-solid, #60a5fa);

    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px 8px 12px;
    border-radius: 999px;
    background: linear-gradient(135deg, #1f1f23, #2a2a30);
    color: #fafafa;
    box-shadow:
      0 6px 20px rgb(0 0 0 / 0.35),
      inset 0 0 0 1px rgb(255 255 255 / 0.08);
  }

  .name {
    color: #a1a1aa;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    line-height: 1;
    text-transform: uppercase;
  }

  select {
    max-inline-size: 220px;
    padding: 3px 6px;
    border: none;
    border-radius: 5px;
    background: rgb(255 255 255 / 0.07);
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.12);
    color: #fafafa;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
  }

  select:hover {
    box-shadow: inset 0 0 0 1px var(--_accent);
  }

  /* The popup is painted by the browser, which does not inherit the pill's dark background. */
  option {
    background: #1f1f23;
    color: #fafafa;
  }

  label[data-production] {
    background: linear-gradient(135deg, #7f1d1d, #b91c1c);
    color: #fff;
    box-shadow:
      0 6px 22px rgb(239 68 68 / 0.5),
      inset 0 0 0 1px rgb(254 202 202 / 0.7);
  }

  label[data-production] .name {
    color: #fee2e2;
  }

  label[data-production] .mark {
    font-size: 15px;
    line-height: 1;
  }

  label[data-production] select {
    background: rgb(0 0 0 / 0.35);
    box-shadow: inset 0 0 0 1px rgb(254 202 202 / 0.6);
    text-transform: uppercase;
  }

  label[data-production] option {
    background: #450a0a;
  }

  label[data-auth] {
    --_accent: var(--et-theme-color-success-solid, #34d399);
  }

  button {
    padding: 3px 7px;
    border: none;
    border-radius: 5px;
    background: rgb(255 255 255 / 0.07);
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.12);
    color: #fafafa;
    font: inherit;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.4;
    cursor: pointer;
  }

  button:hover {
    box-shadow: inset 0 0 0 1px var(--_accent);
  }

  button[data-on] {
    background: rgb(52 211 153 / 0.18);
    box-shadow: inset 0 0 0 1px rgb(52 211 153 / 0.7);
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
    label[data-production] {
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

  const label = doc.createElement('label');
  label.title = production
    ? `${apiSwitch.name} points at production. The data is real. Picking reloads the page.`
    : `${apiSwitch.name} — picking reloads the page`;

  if (production) {
    label.setAttribute('data-production', '');

    const mark = doc.createElement('span');
    mark.className = 'mark';
    mark.textContent = '⚠';
    mark.setAttribute('aria-hidden', 'true');
    label.append(mark);
  }

  const name = doc.createElement('span');
  name.className = 'name';
  name.textContent = production ? `${apiSwitch.name} · live` : apiSwitch.name;

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

  label.append(name, select);

  return label;
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
  const label = doc.createElement('label');
  label.setAttribute('data-auth', '');
  label.title = row.tabLocal
    ? `${row.name} holds this tab's own session. The other tabs are on theirs.`
    : `${row.name} - the session every tab of this app shares`;

  const name = doc.createElement('span');
  name.className = 'name';
  name.textContent = row.tabLocal ? `${row.name} · this tab` : row.name;

  const select = doc.createElement('select');
  select.setAttribute('aria-label', `${row.name} session`);

  const current = doc.createElement('option');
  current.value = '';
  current.textContent = row.current;
  current.selected = !row.options.some((option) => option.selected);
  select.append(current);

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

  label.append(name, select, isolate);

  return label;
};

const render = (doc: Document) => {
  doc.getElementById(HOST_ID)?.remove();

  const switches = envState?.switches ?? [];
  const rows = authState?.rows ?? [];

  if (!switches.length && !rows.length) return;

  const host = doc.createElement('div');
  host.id = HOST_ID;

  // Shadow DOM is intentional, for the same reason the toggle button uses it: this paints over the
  // host application's page and must be as isolated from its global CSS (resets, Tailwind) as possible.
  const shadow = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = STYLE;
  shadow.append(style);

  let production = false;

  for (const row of rows) shadow.append(buildAuthRow(doc, row));

  for (const apiSwitch of switches) {
    const stored = envState?.read(apiSwitch.storageKey) ?? DEFAULT_VALUE;

    production ||= resolvedEnvOf(apiSwitch, stored)?.production === true;
    shadow.append(buildSwitch(doc, apiSwitch, stored, (storageKey, value) => envState?.pick(storageKey, value)));
  }

  if (production) {
    const frame = doc.createElement('div');
    frame.className = 'frame';
    frame.setAttribute('aria-hidden', 'true');
    shadow.append(frame);
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
