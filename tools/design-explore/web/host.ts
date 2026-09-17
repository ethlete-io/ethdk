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

type Band = { round: CallRound | null; options: CallOption[] };

/**
 * A duplicate round key draws its options in two bands, and an option that names no declared
 * round falls into the trailing unnamed band. Both look like a drawing decision, so they are
 * named on the page instead, where `check-call.mjs --call` reads them.
 */
const problemsOf = (call: Call) => {
  const rounds = call.rounds ?? [];
  const keys = rounds.map((round) => round.key);
  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
  const orphans = rounds.length === 0 ? [] : call.options.filter((option) => !keys.includes(option.round ?? ''));

  return [
    ...[...new Set(duplicates)].map((key) => `two rounds share the key "${key}"`),
    ...orphans.map((option) => `option "${option.key}" names no declared round`),
  ];
};

/** A call with no rounds is one unnamed band, which is what the page drew before rounds existed. */
const bandsOf = (call: Call): Band[] => {
  const rounds = call.rounds ?? [];
  if (rounds.length === 0) return [{ round: null, options: call.options }];

  const keys = new Set(rounds.map((round) => round.key));
  const loose = call.options.filter((option) => !option.round || !keys.has(option.round));

  return [
    ...rounds.map((round) => ({ round, options: call.options.filter((option) => option.round === round.key) })),
    ...(loose.length > 0 ? [{ round: null, options: loose }] : []),
  ];
};

/** A call's folder path is its place in the tree, so the sidebar nests on the path segments. */
const tree = (call: Call | null) => {
  const groups = new Map<string, string[]>();
  for (const s of slugs) {
    const parts = s.split('/');
    const group = parts.slice(0, -1).join(' / ');
    groups.set(group, [...(groups.get(group) ?? []), s]);
  }

  const rounds = (s: string) =>
    s !== slug || !call?.rounds?.length
      ? ''
      : `<div class="nav-rounds">${call.rounds
          .map((round, index) => `<a href="#round-${esc(round.key)}">${index + 1} · ${esc(round.title)}</a>`)
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

  const band = ({ round, options }: Band, index: number) => {
    const shown = options.filter((option) => !only || option.key === only);
    if (shown.length === 0) return '';

    const settled = shown.every((option) => option.verdict);
    const open = !round || !settled || !!only || opened.has(round.key);
    const drawn = open ? shown : shown.filter((option) => option.verdict === 'chosen');
    const folded = open ? [] : shown.filter((option) => option.verdict !== 'chosen');

    const head = !round
      ? ''
      : `<div class="round-head">
          <span class="eyebrow">Round ${index + 1}${settled ? ' · settled' : ''}</span>
          <h2>${esc(round.title)}</h2>
          <p>${esc(round.note)}</p>
          ${
            settled
              ? `<a class="fold" href="${toggleOpen(round.key)}">${
                  open ? `Fold ${shown.length} options away` : `Show all ${shown.length} options`
                }</a>`
              : ''
          }
        </div>`;

    return `
      <section class="round" ${round ? `id="round-${esc(round.key)}"` : ''}>
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
                    `<li><a href="${toggleOpen(round?.key ?? '')}">${esc(option.name)}</a><span class="tag">${
                      option.verdict ?? 'open'
                    }</span></li>`,
                )
                .join('')}</ul>`
            : ''
        }
      </section>`;
  };

  document.body.innerHTML = `
    <nav>${tree(call)}</nav>
    <main>
      <header>
        <span class="eyebrow">${esc(call.eyebrow)}</span>
        <h1>${esc(call.headline)}</h1>
        <p>${esc(call.intro)}</p>
      </header>
      ${problemsOf(call)
        .map((problem) => `<p class="problem">design-explore: ${esc(problem)}</p>`)
        .join('')}
      ${bandsOf(call).map(band).join('')}
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
