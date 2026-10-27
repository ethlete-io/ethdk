import { definePart, drawing } from '@design-system';
import card from '@system/components/card';
import { films } from '@system/fixtures';

type Props = { count: number };

export default definePart<Props>({
  note: 'The film library page: a heading and a list of rows, or a card when it is empty.',
  states: { three: { count: 3 }, one: { count: 1 }, empty: { count: 0 } },
  render: async ({ count }) => {
    const empty = await card.render({ title: 'No films yet', body: 'Add a film to start the library.' });

    return drawing({
      body: `<main class="lab-page"><h1>Library</h1>${
        count === 0
          ? empty.body
          : films
              .slice(0, count)
              .map((film) => `<div class="lab-page-row"><span>${film.title}</span><span>${film.year}</span></div>`)
              .join('')
      }</main>`,
      styles: `${empty.styles}
        .lab-page { padding: 24px; font-family: sans-serif; color: var(--lab-ink); }
        .lab-page h1 { margin: 0 0 12px; font-size: 24px; }
        .lab-page-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
      `,
    });
  },
});
