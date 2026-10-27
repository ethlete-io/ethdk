import { definePart, drawing } from '@design-system';
import { films } from '@system/fixtures';

type Props = { index: number; selected: boolean };

export default definePart<Props>({
  note: 'A film row for the lab: title, year and a selected state.',
  madeBy: ['gpt-5.6-sol', 'claude-opus-5-5'],
  states: { first: { index: 0, selected: false }, selected: { index: 1, selected: true } },
  render: ({ index, selected }) => {
    const film = films[index] ?? { title: 'Untitled', year: 0 };
    return drawing({
      body: `<div class="lab-row${selected ? ' is-selected' : ''}"><span>${film.title}</span><span>${film.year}</span></div>`,
      styles: `
        .lab-row { display: flex; justify-content: space-between; width: 320px; padding: 10px 14px; font: 14px sans-serif; color: var(--lab-ink); border-bottom: 1px solid var(--lab-surface); }
        .lab-row.is-selected { background: var(--lab-surface); font-weight: 600; }
      `,
    });
  },
});
