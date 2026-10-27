import { definePart, drawing } from '@design-system';
import card from '@system/components/card';
import loginDialog from '@system/elements/login-dialog';
import shell from '@system/elements/shell-main';
import { films } from '@system/fixtures';

type Props = { count: number; login: boolean };

export default definePart<Props>({
  note: 'The film library page in the main shell: a heading and a list of rows, or a card when it is empty. "login open" shows the login dialog over it.',
  states: {
    three: { count: 3, login: false },
    one: { count: 1, login: false },
    empty: { count: 0, login: false },
    'login open': { count: 3, login: true },
  },
  render: async ({ count, login }) => {
    const empty = await card.render({ title: 'No films yet', body: 'Add a film to start the library.' });
    const dialog = await loginDialog.render({ error: false });
    const rows =
      count === 0
        ? empty.body
        : films
            .slice(0, count)
            .map((film) => `<div class="lab-page-row"><span>${film.title}</span><span>${film.year}</span></div>`)
            .join('');
    const framed = await shell.render({
      active: 'library',
      content: `<main class="lab-page"><h1>Library</h1>${rows}</main>${
        login ? `<div class="lab-page-scrim">${dialog.body}</div>` : ''
      }`,
    });

    return drawing({
      body: framed.body,
      styles: `${framed.styles}${empty.styles}${login ? dialog.styles : ''}
        .lab-page { padding: 24px; font-family: sans-serif; color: var(--lab-ink); }
        .lab-page h1 { margin: 0 0 12px; font-size: 24px; }
        .lab-page-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
        .lab-page-scrim { position: absolute; inset: 0; display: grid; place-items: center; background: color-mix(in srgb, var(--lab-ink) 40%, transparent); }
      `,
    });
  },
});
