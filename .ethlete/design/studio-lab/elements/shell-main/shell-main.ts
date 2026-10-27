import { definePart, drawing } from '@design-system';

type Props = { active: 'library' | 'watchlist'; content: string };

const LINKS = [
  { key: 'library', label: 'Library' },
  { key: 'watchlist', label: 'Watchlist' },
] as const;

export default definePart<Props>({
  note: 'The main shell of the lab app: a top bar with the app name and its sections around the page content.',
  states: {
    library: { active: 'library', content: '' },
    watchlist: { active: 'watchlist', content: '' },
  },
  render: ({ active, content }) =>
    drawing({
      body: `<div class="lab-shell"><header class="lab-shell-bar"><strong>Filmbox</strong><nav>${LINKS.map(
        (link) => `<span class="lab-shell-link${link.key === active ? ' is-active' : ''}">${link.label}</span>`,
      ).join('')}</nav></header><div class="lab-shell-content">${content}</div></div>`,
      styles: `
        .lab-shell { position: relative; min-height: 100vh; font-family: sans-serif; color: var(--lab-ink); }
        .lab-shell-bar { display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; border-bottom: 1px solid var(--lab-surface); }
        .lab-shell-bar nav { display: flex; gap: 16px; font-size: 14px; }
        .lab-shell-link.is-active { color: var(--lab-accent); font-weight: 600; }
      `,
    }),
});
