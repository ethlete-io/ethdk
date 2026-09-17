import type { Call, CallOption, CallRound } from '@design-explore';
import { calls, defaultCall } from 'virtual:design-explore';
import './host.css';

const params = new URLSearchParams(location.search);
const slugs = Object.keys(calls);
const asked = params.get('call') ?? '';
const landing = defaultCall && slugs.includes(defaultCall) ? defaultCall : (slugs.at(-1) ?? '');
const slug = slugs.includes(asked) ? asked : landing;
const only = params.get('only');
const opened = new Set((params.get('open') ?? '').split(',').filter(Boolean));

const esc = (text: string) => text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);

const link = (next: Record<string, string | null>) => {
  const url = new URLSearchParams(params);
  for (const [name, value] of Object.entries(next)) {
    if (value === null) url.delete(name);
    else url.set(name, value);
  }
  return `?${url}`;
};

const toggleOpen = (key: string) => {
  const next = new Set(opened);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return link({ open: next.size > 0 ? [...next].join(',') : null });
};

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
    s !== slug || named.length < 2
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
              `<a href="${link({ call: s, only: null, open: null })}" ${s === slug ? 'aria-current="page"' : ''}>${esc(
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
  const isView = call.options.length === 1 && !call.options[0]?.claim;

  const column = (option: CallOption) => `
    <div class="column" data-verdict="${option.verdict ?? 'open'}">
      ${
        isView
          ? ''
          : `<h3>
        <a href="${link({ only: only === option.key ? null : option.key })}">${esc(option.name)}</a>
        <span class="tag">${option.verdict ?? 'open'}</span>
      </h3>`
      }
      <div class="stage">
        <iframe
          src="frame.html?call=${encodeURIComponent(slug)}&option=${encodeURIComponent(option.key)}"
          data-option="${esc(option.key)}"
          title="${esc(option.name)}"
          style="width:${call.frameWidth}px"
        ></iframe>
      </div>
      ${option.claim ? `<p class="claim">${esc(option.claim)}</p>` : ''}
      ${option.cost ? `<p class="cost">${esc(option.cost)}</p>` : ''}
    </div>`;

  const band = ({ key, number, round, options }: Band) => {
    const shown = options.filter((option) => !only || option.key === only);
    if (shown.length === 0) return '';

    const settled = shown.every((option) => option.verdict);
    const open = !key || !settled || !!only || opened.has(key);
    const drawn = open ? shown : shown.filter((option) => option.verdict === 'chosen');
    const folded = open ? [] : shown.filter((option) => option.verdict !== 'chosen');

    const head = !key
      ? ''
      : `<div class="round-head">
          <span class="eyebrow">Round ${number}${settled ? ' · settled' : ''}</span>
          <h2>${esc(round?.title ?? key)}</h2>
          ${round?.note ? `<p>${esc(round.note)}</p>` : ''}
          ${
            settled
              ? `<a class="fold" href="${toggleOpen(key)}">${
                  open ? `Fold ${shown.length} options away` : `Show all ${shown.length} options`
                }</a>`
              : ''
          }
        </div>`;

    return `
      <section class="round" ${key ? `id="round-${esc(key)}"` : ''}>
        ${head}
        ${
          drawn.length > 0
            ? `<div class="grid" style="--frame-width:${call.frameWidth}px" ${isView ? 'data-view' : ''}>${drawn
                .map(column)
                .join('')}</div>`
            : ''
        }
        ${
          folded.length > 0
            ? `<ul class="folded">${folded
                .map(
                  (option) =>
                    `<li><a href="${toggleOpen(key ?? '')}">${esc(option.name)}</a><span class="tag">${
                      option.verdict ?? 'open'
                    }</span></li>`,
                )
                .join('')}</ul>`
            : ''
        }
      </section>`;
  };

  document.body.innerHTML = `
    <nav>${tree(bands)}</nav>
    <main>
      <header>
        <span class="eyebrow">${esc(call.eyebrow)}</span>
        <h1>${esc(call.headline)}</h1>
        <p>${esc(call.intro)}</p>
      </header>
      ${problemsOf(call, bands)
        .map((problem) => `<p class="problem">design-explore: ${esc(problem)}</p>`)
        .join('')}
      ${bands.map(band).join('')}
    </main>`;
}

/**
 * A frame reports its height late, so the page grows under the reader for a second or two after
 * load. The scroll is put back on every one of those reports, until the reader scrolls or the
 * frames go quiet, because a single restore lands on a page that is still the wrong height.
 */
const scrollKey = `design-explore:scroll:${slug}`;

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

addEventListener('message', (event) => {
  const data = event.data as { type?: string; option?: string; height?: number };
  if (data?.type !== 'design-explore:height') return;

  const frame = document.querySelector<HTMLIFrameElement>(`iframe[data-option="${data.option}"]`);
  if (frame && data.height) frame.style.height = `${data.height}px`;
  if (restoring) scrollTo(0, target);
});
