import { definePart, drawing } from '@design-system';
import { box, button, icon, image, input, textLines } from '@design-system/kit';
import { films } from '@system/fixtures';

type Props = { index: number; reviewing: boolean };

export default definePart<Props>({
  note: 'Wireframe of the film detail page: poster, synopsis and actions, with a review field once the user starts one.',
  states: { rest: { index: 0, reviewing: false }, reviewing: { index: 1, reviewing: true } },
  render: ({ index, reviewing }) => {
    const film = films[index] ?? { title: 'Untitled', year: 0 };

    return drawing({
      body: box(
        [
          box([icon(), textLines({ lines: 1, width: 120 })], { direction: 'row', plain: true, padding: 0 }),
          box(
            [
              image({ width: 220, height: 320 }),
              box(
                [
                  `<h1 style="margin:0;font:600 24px sans-serif">${film.title} (${film.year})</h1>`,
                  textLines({ lines: 5 }),
                  box([button('Add to watchlist', { primary: true }), button('Share')], {
                    direction: 'row',
                    plain: true,
                    padding: 0,
                  }),
                  reviewing ? input({ label: 'Your review', placeholder: 'What did you think?' }) : '',
                ],
                { plain: true, padding: 0, grow: true },
              ),
            ],
            { direction: 'row', gap: 24 },
          ),
        ],
        { plain: true, padding: 24, gap: 24 },
      ),
      styles: '',
    });
  },
});
