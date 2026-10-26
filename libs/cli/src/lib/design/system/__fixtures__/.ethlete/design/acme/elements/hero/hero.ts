import { definePart, drawing, html } from '@design-system';
import button from '@system/components/button';
import { Film, films } from '@system/fixtures';
import styles from './hero.css?inline';

export type HeroProps = { film: Film };

export default definePart<HeroProps>({
  note: 'One featured film with its play button.',
  states: { default: { film: films[0] ?? { title: '' } } },
  render: async ({ film }) => {
    const play = await button.render({ label: 'Play' });

    return drawing({
      body: html`<section class="acme-hero">
        <h1>${film.title}</h1>
        ${play.body}
      </section>`,
      styles: styles + play.styles,
    });
  },
});
