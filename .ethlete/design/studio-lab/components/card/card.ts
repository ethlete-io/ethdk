import { definePart, drawing } from '@design-system';

type Props = { title: string; body: string };

export default definePart<Props>({
  note: 'Lab card: a title and a short body. It fills its container, so it lists the widths it is drawn at.',
  widths: [240, 360, 520],
  states: {
    default: { title: 'Card title', body: 'A short body text.' },
    long: {
      title: 'A longer card title that wraps',
      body: 'A longer body that runs over several lines to test wrapping inside the frame.',
    },
  },
  render: ({ title, body }) =>
    drawing({
      body: `<article class="lab-card box-border"><h3 class="m-0">${title}</h3><p class="m-0">${body}</p></article>`,
      styles: `
        .lab-card { padding: 16px; border-radius: 10px; background: var(--lab-surface); color: var(--lab-ink); font-family: sans-serif; }
        .lab-card h3 { margin-bottom: 6px; font-size: 16px; }
        .lab-card p { font-size: 14px; }
      `,
    }),
});
