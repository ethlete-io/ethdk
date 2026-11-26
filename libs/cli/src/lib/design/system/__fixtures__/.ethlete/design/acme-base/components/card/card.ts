import { definePart, drawing, html } from '@design-system';
import button from '@system/components/button';
import styles from './card.css?inline';

export type CardProps = { title: string };

export default definePart<CardProps>({
  note: 'A card with one action.',
  states: { default: { title: 'A film' }, long: { title: 'A film with a much longer title than most' } },
  describe: { default: 'A film card; check its title.', long: 'A long title; check that it wraps.' },
  render: async ({ title }) => {
    const action = await button.render({ label: 'Play' });

    return drawing({
      body: html`<article class="acme-card">
        <h3>${title}</h3>
        ${action.body}
      </article>`,
      styles: styles + action.styles,
    });
  },
});
