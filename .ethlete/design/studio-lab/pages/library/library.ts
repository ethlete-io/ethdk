import { definePart, drawing } from '@design-system';
import button from '@system/components/button';
import card from '@system/components/card';
import addFilmDialog from '@system/elements/add-film-dialog';
import loginDialog from '@system/elements/login-dialog';
import shell from '@system/elements/shell-main';
import { films } from '@system/fixtures';

type Props = { count: number; overlay: 'none' | 'login' | 'login error' | 'add'; user?: string };

export default definePart<Props>({
  note: 'The film library page in the main shell: a heading and a list of rows, or a card when it is empty. An overlay state shows the add-a-film or login dialog over it.',
  states: {
    three: { count: 3, overlay: 'none' },
    one: { count: 1, overlay: 'none' },
    empty: { count: 0, overlay: 'none' },
    'add open': { count: 0, overlay: 'add' },
    'login open': { count: 3, overlay: 'login' },
    'login error': { count: 3, overlay: 'login error' },
    'signed in': { count: 3, overlay: 'none', user: 'Ada' },
  },
  render: async ({ count, overlay, user }) => {
    const empty = await card.render({ title: 'No films yet', body: 'Add a film to start the library.' });
    const addButton = await button.render({ label: 'Add a film', variant: 'solid' });
    const dialog =
      overlay === 'add'
        ? await addFilmDialog.render({})
        : overlay === 'none'
          ? null
          : await loginDialog.render({ error: overlay === 'login error' });
    const rows =
      count === 0
        ? `${empty.body}<div class="lab-page-action">${addButton.body}</div>`
        : films
            .slice(0, count)
            .map((film) => `<div class="lab-page-row"><span>${film.title}</span><span>${film.year}</span></div>`)
            .join('');
    const framed = await shell.render({
      active: 'library',
      user,
      content: `<main class="lab-page"><h1>Library</h1>${rows}</main>${
        dialog ? `<div class="lab-page-scrim">${dialog.body}</div>` : ''
      }`,
    });

    return drawing({
      body: framed.body,
      styles: `${framed.styles}${empty.styles}${addButton.styles}${dialog?.styles ?? ''}
        .lab-page { padding: 24px; font-family: sans-serif; color: var(--lab-ink); }
        .lab-page h1 { margin: 0 0 12px; font-size: 24px; }
        .lab-page-action { margin-top: 12px; }
        .lab-page-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
        .lab-page-scrim { position: fixed; inset: 0; display: grid; place-items: center; background: color-mix(in srgb, var(--lab-ink) 40%, transparent); }
      `,
    });
  },
});
