import { css, definePart, html } from '@design-system';

type Props = { title: string; meta: string };

const POSTER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#456"/></svg>',
  );

export default definePart({
  note: 'A card with a poster that scales with the width and two text lines under it.',
  widths: [112, 168],
  states: { poster: { title: 'Card title', meta: '2024 · Item' } },
  describe: { poster: 'The poster at full width with the title and the meta line under it.' },
  render: ({ title, meta }: Props) => ({
    body: html`<div class="card">
      <img class="card-poster" src="${POSTER}" alt="" />
      <p class="card-line">${title}</p>
      <p class="card-line">${meta}</p>
    </div>`,
    styles: css`
      .card {
        display: block;
        font: 14px/20px sans-serif;
      }

      .card-poster {
        display: block;
        width: 100%;
        height: auto;
      }

      .card-line {
        margin: 0;
      }
    `,
  }),
});
