import { definePart, drawing } from '@design-system';

type Props = { active: 'library' | 'watchlist'; content: string; user?: string };

const LINKS = [
  { key: 'library', label: 'Library' },
  { key: 'watchlist', label: 'Watchlist' },
] as const;

export default definePart<Props>({
  note: 'The main shell of the lab app: a top bar with the app name, its sections and a Log in button (or the signed-in user) around the page content.',
  madeBy: ['claude-sonnet-5-5'],
  states: {
    library: { active: 'library', content: '' },
    watchlist: { active: 'watchlist', content: '' },
    'signed in': { active: 'library', content: '', user: 'Ada' },
  },
  render: ({ active, content, user }) =>
    drawing({
      body: `<div class="lab-shell relative font-ui"><header class="lab-shell-bar flex items-center justify-between"><strong>Filmbox</strong><nav class="flex">${LINKS.map(
        (link) => `<span class="lab-shell-link ${link.key === active ? 'is-active' : ''}">${link.label}</span>`,
      ).join('')}</nav>${
        user
          ? `<span class="lab-shell-user">${user}</span>`
          : '<button class="lab-shell-login" type="button">Log in</button>'
      }</header><div class="lab-shell-content">${content}</div></div>`,
      styles: `
        .lab-shell { min-height: 480px; color: var(--lab-ink); }
        .lab-shell-bar { padding: 12px 24px; border-bottom: 1px solid var(--lab-surface); }
        .lab-shell-bar nav { gap: 16px; font-size: 14px; }
        .lab-shell-login { padding: 6px 12px; border: 1px solid var(--lab-ink); border-radius: 6px; background: none; color: inherit; font: inherit; font-size: 13px; }
        .lab-shell-user { font-size: 14px; font-weight: 600; }
        .lab-shell-link.is-active { color: var(--lab-accent); font-weight: 600; }
      `,
    }),
});
