import type { Call } from '@design-explore';
import { calls } from 'virtual:design-explore';
import './host.css';

const params = new URLSearchParams(location.search);
const slugs = Object.keys(calls);
const asked = params.get('call') ?? '';
const slug = slugs.includes(asked) ? asked : (slugs.at(-1) ?? '');
const only = params.get('only');

const esc = (text: string) => text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);

const link = (next: Record<string, string | null>) => {
  const url = new URLSearchParams(params);
  for (const [name, value] of Object.entries(next)) {
    if (value === null) url.delete(name);
    else url.set(name, value);
  }
  return `?${url}`;
};

/** A call's folder path is its place in the tree, so the sidebar nests on the path segments. */
const tree = () => {
  const groups = new Map<string, string[]>();
  for (const s of slugs) {
    const parts = s.split('/');
    const group = parts.slice(0, -1).join(' / ');
    groups.set(group, [...(groups.get(group) ?? []), s]);
  }

  return [...groups]
    .map(
      ([group, members]) => `
      <section>
        ${group ? `<h3>${esc(group)}</h3>` : ''}
        ${members
          .map(
            (s) =>
              `<a href="${link({ call: s, only: null })}" ${s === slug ? 'aria-current="page"' : ''}>${esc(
                s.split('/').at(-1) ?? s,
              )}</a>`,
          )
          .join('')}
      </section>`,
    )
    .join('');
};

if (!slug) {
  document.body.innerHTML = `<p class="empty">No call under callsRoot in design-explore.config.json.</p>`;
} else {
  const call: Call = (await calls[slug]()).default;
  const shown = call.options.filter((option) => !only || option.key === only);

  document.body.innerHTML = `
    <nav>${tree()}</nav>
    <main>
      <header>
        <span class="eyebrow">${esc(call.eyebrow)}</span>
        <h1>${esc(call.headline)}</h1>
        <p>${esc(call.intro)}</p>
        ${call.result ? `<p class="result"><span>Result</span>${esc(call.result)}</p>` : ''}
      </header>
      <div class="grid">
        ${shown
          .map(
            (option) => `
          <div class="column" data-verdict="${option.verdict ?? 'open'}">
            <h2>
              <a href="${link({ only: only === option.key ? null : option.key })}">${esc(option.name)}</a>
              <span class="tag">${option.verdict ?? 'open'}</span>
            </h2>
            <div class="stage">
              <iframe
                src="frame.html?call=${encodeURIComponent(slug)}&option=${encodeURIComponent(option.key)}"
                data-option="${esc(option.key)}"
                title="${esc(option.name)}"
                style="width:${call.frameWidth}px"
              ></iframe>
            </div>
            <p class="claim">${esc(option.claim)}</p>
            <p class="cost">${esc(option.cost)}</p>
          </div>`,
          )
          .join('')}
      </div>
    </main>`;
}

addEventListener('message', (event) => {
  const data = event.data as { type?: string; option?: string; height?: number };
  if (data?.type !== 'design-explore:height') return;

  const frame = document.querySelector<HTMLIFrameElement>(`iframe[data-option="${data.option}"]`);
  if (frame && data.height) frame.style.height = `${data.height}px`;
});
