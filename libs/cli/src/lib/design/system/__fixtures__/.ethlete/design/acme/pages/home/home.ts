import { definePart, drawing, html } from '@design-system';
import card from '@system/components/card';
import hero from '@system/elements/hero';
import { Film, films } from '@system/fixtures';

export type HomeProps = { films: Film[] };

export default definePart<HomeProps>({
  note: 'A hero over a list of cards.',
  states: { default: { films }, empty: { films: [] } },
  render: async (props) => {
    const top = await hero.render({ film: props.films[0] ?? { title: 'Nothing yet' } });
    const cards = await Promise.all(props.films.map((film) => card.render({ title: film.title })));

    return drawing({
      body: html`<main>${top.body}${cards.map((drawn) => drawn.body)}</main>`,
      styles: top.styles + (cards[0]?.styles ?? ''),
    });
  },
});
