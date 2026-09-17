import type { Call, CallOption, CallRound } from '@design-explore';
import { calls, defaultCall } from 'virtual:design-explore';
import './host.css';

/** The contact sheet draws about five 1100px frames per screen at this scale. */
const SHEET_SCALE = 0.32;

const params = new URLSearchParams(location.search);
const slugs = Object.keys(calls);
const asked = params.get('call') ?? '';
const landing = defaultCall && slugs.includes(defaultCall) ? defaultCall : (slugs.at(-1) ?? '');
const slug = slugs.includes(asked) ? asked : landing;
const view = params.get('view') === 'sheet' ? 'sheet' : 'rounds';
const opened = new Set((params.get('open') ?? '').split(',').filter(Boolean));
const picked = (params.get('pick') ?? '').split(',').filter(Boolean);

/** The frame geometry of the open call, read by the fit pass after the page is built. */
let frameWidth = 0;

const esc = (text: string) => text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);

const link = (next: Record<string, string | null>) => {
  const url = new URLSearchParams(params);
  for (const [name, value] of Object.entries(next)) {
    if (value === null) url.delete(name);
    else url.set(name, value);
  }
  return `?${url}`;
};

const listLink = (name: string, list: string[], key: string) => {
  const next = list.includes(key) ? list.filter((entry) => entry !== key) : [...list, key];
  return link({ [name]: next.length > 0 ? next.join(',') : null });
};

const toggleOpen = (key: string) => listLink('open', [...opened], key);
const togglePick = (key: string) => listLink('pick', picked, key);

type Band = { key: string | null; number: number; round: CallRound | null; options: CallOption[] };

/**
 * The options are the call. A band exists because an option names it, never because `rounds`
 * declares it, so an option added without its round entry still gets a band, a heading and a
 * menu row - all three say the bare key until somebody writes the prose.
 */
const bandsOf = (call: Call): Band[] => {
  const declared = new Map((call.rounds ?? []).map((round) => [round.key, round]));
  const bands = new Map<string, Band>();

  for (const option of call.options) {
    const key = option.round ?? '';
    const band = bands.get(key) ?? { key: key || null, number: 0, round: declared.get(key) ?? null, options: [] };
    band.options.push(option);
    bands.set(key, band);
  }

  let number = 0;
  for (const band of bands.values()) if (band.key) band.number = ++number;

  return [...bands.values()];
};

/** Prose that no option claims is stale prose, and it is the one thing the options cannot show. */
const problemsOf = (call: Call, bands: Band[]) => {
  const keys = (call.rounds ?? []).map((round) => round.key);
  const drawn = new Set(bands.map((band) => band.key));

  return [
    ...[...new Set(keys.filter((key, index) => keys.indexOf(key) !== index))].map(
      (key) => `two rounds share the key "${key}"`,
    ),
    ...keys.filter((key) => !drawn.has(key)).map((key) => `round "${key}" has no options`),
  ];
};

/**
 * A call is resolved once every round has ruled and at least one round has a winner. Its rounds
 * then draw nothing, because each winner is the one before it plus a change, so the last of them
 * already holds all the others.
 */
const chainOf = (bands: Band[]) => {
  const named = bands.filter((band) => band.key);
  const ruled = named.length > 1 && named.every((band) => band.options.every((option) => option.verdict));
  const chain = named
    .map((band) => band.options.find((option) => option.verdict === 'chosen'))
    .filter((option): option is CallOption => !!option);

  return ruled && chain.length > 0 ? chain : [];
};

/** A call's folder path is its place in the tree, so the sidebar nests on the path segments. */
const tree = (bands: Band[]) => {
  const groups = new Map<string, string[]>();
  for (const s of slugs) {
    const parts = s.split('/');
    const group = parts.slice(0, -1).join(' / ');
    groups.set(group, [...(groups.get(group) ?? []), s]);
  }

  const named = bands.filter((band) => band.key);

  const rounds = (s: string) =>
    s !== slug || view === 'sheet' || named.length < 2
      ? ''
      : `<div class="nav-rounds">${named
          .map(
            (band) =>
              `<a href="#round-${esc(band.key ?? '')}">${band.number} · ${esc(band.round?.title ?? band.key ?? '')}</a>`,
          )
          .join('')}</div>`;

  return [...groups]
    .map(
      ([group, members]) => `
      <section>
        ${group ? `<h3>${esc(group)}</h3>` : ''}
        ${members
          .map(
            (s) =>
              `<a href="${link({ call: s, open: null, pick: null })}" ${s === slug ? 'aria-current="page"' : ''}>${esc(
                s.split('/').at(-1) ?? s,
              )}</a>${rounds(s)}`,
          )
          .join('')}
      </section>`,
    )
    .join('');
};

const load = slug ? calls[slug] : undefined;

if (!load) {
  document.body.innerHTML = `<p class="empty">No call under callsRoot in design-explore.config.json.</p>`;
} else {
  const call: Call = (await load()).default;
  const bands = bandsOf(call);
  const chain = chainOf(bands);
  const result = chain.at(-1);
  const isView = call.options.length === 1 && !call.options[0]?.claim;
  const geometry = `--frame-width:${call.frameWidth}px`;
  frameWidth = call.frameWidth;

  const frame = (option: CallOption) => `
    <iframe
      src="frame.html?call=${encodeURIComponent(slug)}&option=${encodeURIComponent(option.key)}"
      data-option="${esc(option.key)}"
      title="${esc(option.name)}"
      style="width:${call.frameWidth}px"
    ></iframe>`;

  const column = (option: CallOption) => `
    <div class="column" data-verdict="${option.verdict ?? 'open'}" ${picked.includes(option.key) ? 'data-picked' : ''}>
      ${
        isView
          ? ''
          : `<h3>
        <a href="${togglePick(option.key)}">${esc(option.name)}</a>
        <span class="tag">${option.verdict ?? 'open'}</span>
      </h3>`
      }
      <div class="stage">${frame(option)}</div>
      ${option.claim ? `<p class="claim">${esc(option.claim)}</p>` : ''}
      ${option.cost ? `<p class="cost">${esc(option.cost)}</p>` : ''}
    </div>`;

  const grid = (options: CallOption[]) =>
    options.length === 0
      ? ''
      : `<div class="grid" style="${geometry}" ${isView ? 'data-view' : ''}>${options.map(column).join('')}</div>`;

  const rows = (options: CallOption[]) =>
    options.length === 0
      ? ''
      : `<ul class="folded">${options
          .map(
            (option) =>
              `<li data-verdict="${option.verdict ?? 'open'}"><a href="${togglePick(option.key)}">${esc(
                option.name,
              )}</a><span class="tag">${option.verdict ?? 'open'}</span></li>`,
          )
          .join('')}</ul>`;

  const band = ({ key, number, round, options }: Band) => {
    const settled = options.every((option) => option.verdict);
    const open = !key || !settled || opened.has(key);
    const drawn = open ? options : chain.length > 0 ? [] : options.filter((option) => option.verdict === 'chosen');
    const folded = options.filter((option) => !drawn.includes(option));

    const head = !key
      ? ''
      : `<div class="round-head">
          <span class="eyebrow">Round ${number}${settled ? ' · settled' : ''}</span>
          <h2>${esc(round?.title ?? key)}</h2>
          ${round?.note ? `<p>${esc(round.note)}</p>` : ''}
          ${
            settled
              ? `<a class="fold" href="${toggleOpen(key)}">${
                  open ? `Fold ${options.length} options away` : `Show all ${options.length} options`
                }</a>`
              : ''
          }
        </div>`;

    return `
      <section class="round" ${key ? `id="round-${esc(key)}"` : ''}>
        ${head}
        ${grid(drawn)}
        ${rows(folded)}
      </section>`;
  };

  /** Each step is the one before it plus a change, so the arrow is the order they were drawn in. */
  const trail = () =>
    chain
      .map((option) => {
        const band = bands.find((entry) => entry.options.includes(option));
        const target = band?.key ? `${toggleOpen(band.key)}#round-${band.key}` : togglePick(option.key);
        return `<a href="${esc(target)}" ${option === result ? 'aria-current="step"' : ''}>${esc(
          option.key.toUpperCase(),
        )}</a>`;
      })
      .join('<span class="arrow">→</span>');

  const resultBand = () =>
    !result
      ? ''
      : `<section class="round result">
          <div class="round-head">
            <span class="eyebrow">Result</span>
            <h2>${esc(result.name)}</h2>
            ${result.claim ? `<p>${esc(result.claim)}</p>` : ''}
            <div class="trail">${trail()}</div>
          </div>
          <div class="grid" style="${geometry}">
            <div class="column" data-verdict="chosen">
              <div class="stage">${frame(result)}</div>
              ${result.cost ? `<p class="cost">${esc(result.cost)}</p>` : ''}
            </div>
          </div>
        </section>`;

  const tray = () => {
    const options = picked
      .map((key) => call.options.find((option) => option.key === key))
      .filter((option): option is CallOption => !!option);
    if (options.length === 0) return '';

    const two = options.length === 2;

    return `
      <section class="round tray">
        <div class="round-head">
          <span class="eyebrow">Compare · ${options.length}</span>
          <h2>${options.map((option) => esc(option.name)).join('  ·  ')}</h2>
          <div class="switch">
            ${options
              .map((option, index) => `<button data-step="${index}">${esc(option.key.toUpperCase())}</button>`)
              .join('')}
            <span class="hint">${
              two ? 'click or space to blink · arrows to wipe' : 'click or space for the next one'
            }</span>
          </div>
          <a class="fold" href="${link({ pick: null })}">Clear the comparison</a>
        </div>
        <div class="overlay" data-two="${two}" style="width:${call.frameWidth}px">
          ${options.map(frame).join('')}
          <div class="seam"></div>
        </div>
      </section>`;
  };

  const sheet = () => `
    <div class="grid sheet" style="${geometry};--de-scale:${SHEET_SCALE}">
      ${call.options
        .map(
          (option) => `
        <a class="thumb" href="${togglePick(option.key)}" data-verdict="${option.verdict ?? 'open'}" ${
          picked.includes(option.key) ? 'data-picked' : ''
        }>
          <div class="thumb-frame">${frame(option)}</div>
          <span class="thumb-name">${esc(option.name)}</span>
        </a>`,
        )
        .join('')}
    </div>`;

  const views = () =>
    isView
      ? ''
      : `<div class="views">
          <a href="${link({ view: null })}" ${view === 'rounds' ? 'aria-current="page"' : ''}>rounds</a>
          <a href="${link({ view: 'sheet' })}" ${view === 'sheet' ? 'aria-current="page"' : ''}>all ${
            call.options.length
          }</a>
        </div>`;

  document.body.innerHTML = `
    <nav>${tree(bands)}</nav>
    <main>
      <header>
        <span class="eyebrow">${esc(call.eyebrow)}</span>
        <h1>${esc(call.headline)}</h1>
        <p>${esc(call.intro)}</p>
        ${views()}
      </header>
      ${problemsOf(call, bands)
        .map((problem) => `<p class="problem">design-explore: ${esc(problem)}</p>`)
        .join('')}
      ${tray()}
      ${view === 'sheet' ? sheet() : `${resultBand()}${bands.map(band).join('')}`}
    </main>`;
}

/**
 * A frame reports its height late, so the page grows under the reader for a second or two after
 * load. The scroll is put back on every one of those reports, until the reader scrolls or the
 * frames go quiet, because a single restore lands on a page that is still the wrong height.
 */
const scrollKey = `design-explore:scroll:${slug}:${view}`;

history.scrollRestoration = 'manual';

let restoring = true;
const target = Number(sessionStorage.getItem(scrollKey) ?? 0);

const stopRestore = () => {
  restoring = false;
};

if (target > 0 && !location.hash) {
  for (const event of ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const) {
    addEventListener(event, stopRestore, { once: true, passive: true });
  }
  setTimeout(stopRestore, 3000);
  scrollTo(0, target);
} else {
  restoring = false;
}

addEventListener(
  'scroll',
  () => {
    if (!restoring) sessionStorage.setItem(scrollKey, String(Math.round(scrollY)));
  },
  { passive: true },
);

const heights = new Map<string, number>();

/** The overlay is as tall as its tallest pick, so no frame is cut and none of them move. */
const size = () => {
  for (const frame of document.querySelectorAll<HTMLIFrameElement>('iframe[data-option]')) {
    const height = heights.get(frame.dataset.option ?? '');
    if (!height) continue;

    frame.style.height = `${height}px`;

    const box = frame.parentElement;
    if (box?.classList.contains('thumb-frame')) box.style.height = `${Math.ceil(height * SHEET_SCALE)}px`;
  }

  const overlay = document.querySelector<HTMLElement>('.overlay');
  if (!overlay) return;

  const tallest = [...overlay.querySelectorAll<HTMLIFrameElement>('iframe')]
    .map((frame) => heights.get(frame.dataset.option ?? '') ?? 0)
    .reduce((a, b) => Math.max(a, b), 0);

  if (tallest > 0) overlay.style.height = `${tallest}px`;
};

addEventListener('message', (event) => {
  const data = event.data as { type?: string; option?: string; height?: number };
  if (data?.type !== 'design-explore:height' || !data.height || !data.option) return;

  heights.set(data.option, data.height);
  size();

  if (restoring) scrollTo(0, target);
});

/**
 * Two drawings that differ by a few pixels can only be told apart in one place, so the picks are
 * stacked at full size and the reader switches between them. Two picks also get a wipe: the
 * second one is clipped from the left, so dragging the seam turns one into the other.
 */
const overlay = document.querySelector<HTMLElement>('.overlay');

if (overlay) {
  const frames = [...overlay.querySelectorAll<HTMLIFrameElement>('iframe')];
  const steps = [...document.querySelectorAll<HTMLButtonElement>('.switch button')];
  const seam = overlay.querySelector<HTMLElement>('.seam');
  const two = overlay.dataset.two === 'true';

  let wipe = 50;
  let active = 0;

  const paint = () => {
    frames.forEach((frame, index) => {
      if (two && index === 1) {
        frame.style.clipPath = `inset(0 0 0 ${wipe}%)`;
        frame.style.opacity = '1';
      } else if (two) {
        frame.style.opacity = '1';
      } else {
        frame.style.opacity = index === active ? '1' : '0';
      }
    });

    if (seam) {
      seam.style.left = `${wipe}%`;
      seam.hidden = !two || wipe === 0 || wipe === 100;
    }

    const shown = two ? (wipe > 50 ? 0 : 1) : active;
    steps.forEach((step, index) => step.toggleAttribute('aria-current', index === shown));
  };

  const next = () => {
    if (two) wipe = wipe > 50 ? 0 : 100;
    else active = (active + 1) % frames.length;
    paint();
  };

  const go = (index: number) => {
    if (two) wipe = index === 0 ? 100 : 0;
    else active = index;
    paint();
  };

  steps.forEach((step, index) => step.addEventListener('click', () => go(index)));
  overlay.addEventListener('click', next);

  addEventListener('keydown', (event) => {
    if (event.target !== document.body) return;

    if (event.key === ' ') next();
    else if (two && event.key === 'ArrowLeft') wipe = Math.max(0, wipe - 5);
    else if (two && event.key === 'ArrowRight') wipe = Math.min(100, wipe + 5);
    else if (!two && event.key === 'ArrowLeft') active = (active - 1 + frames.length) % frames.length;
    else if (!two && event.key === 'ArrowRight') active = (active + 1) % frames.length;
    else return;

    event.preventDefault();
    paint();
  });

  paint();
}
