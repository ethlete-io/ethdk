/* eslint-disable ethlete/no-direct-dom-manipulation, ethlete/no-dom-query -- both rules assume a
   component with a Renderer2 and a template. This pill has neither on purpose: see
   `renderQueryDevtoolsApiEnvPill` below for why it cannot be a component. */
import { QueryDevtoolsApiEnv, QueryDevtoolsApiEnvSwitch } from './query-devtools-api-envs';

const HOST_ID = 'et-query-devtools-api-env-pill';

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

const render = (
  doc: Document,
  list: QueryDevtoolsApiEnvSwitch[],
  read: (storageKey: string) => string | null,
  pick: (storageKey: string, value: string | null) => void,
) => {
  doc.getElementById(HOST_ID)?.remove();

  if (!list.length) return;

  const host = doc.createElement('div');
  host.id = HOST_ID;

  // Shadow DOM is intentional, for the same reason the toggle button uses it: this paints over the
  // host application's page and must be as isolated from its global CSS (resets, Tailwind) as possible.
  const shadow = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = STYLE;
  shadow.append(style);

  let production = false;

  for (const apiSwitch of list) {
    const stored = read(apiSwitch.storageKey) ?? DEFAULT_VALUE;

    production ||= resolvedEnvOf(apiSwitch, stored)?.production === true;
    shadow.append(buildSwitch(doc, apiSwitch, stored, pick));
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
 * Paints the API env picker straight onto `document.body`, outside any Angular component tree.
 *
 * It cannot be a component: an application whose boot is stuck on the backend it was just pointed at -
 * a blocking initial navigation waiting out an auth call that never answers - renders no component at
 * all, and that is exactly when somebody needs to pick a different backend. Mounted from
 * `setQueryDevtoolsApiEnvs()`, which runs while `provideQueryDevtools()` is being called, this is on
 * the page before `bootstrapApplication` starts.
 *
 * @internal
 */
export const renderQueryDevtoolsApiEnvPill = (
  list: QueryDevtoolsApiEnvSwitch[],
  read: (storageKey: string) => string | null,
  pick: (storageKey: string, value: string | null) => void,
) => {
  const doc = globalThis.document as Document | undefined;

  if (!doc) return;

  if (doc.body) render(doc, list, read, pick);
  else doc.addEventListener('DOMContentLoaded', () => render(doc, list, read, pick), { once: true });
};
