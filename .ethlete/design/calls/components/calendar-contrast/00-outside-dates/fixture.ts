import { css, html } from '@design-explore';
import { baseStyles, contrast, ratio, rgb, SURFACES, type Surface } from './contrast';

export type Treatment = { tone: 'subtle' | 'muted' };

const WEEKS: [number, number[]][] = [
  [40, [28, 29, 30, 1, 2, 3, 4]],
  [41, [5, 6, 7, 8, 9, 10, 11]],
  [44, [26, 27, 28, 29, 30, 31, 1]],
];

const isOutside = (row: number, day: number) => (row === 0 ? day > 20 : row === 2 ? day < 10 : false);

const panel = (treatment: Treatment, surface: Surface) => {
  const tone = surface[treatment.tone];
  return html`<section class="surface" style="background:${rgb(surface.background)};color:${rgb(surface.color)}">
    <h3>${surface.name}</h3>
    <div class="grid">
      ${WEEKS.map(
        ([week, days], row) =>
          html`<span class="cell week" style="color:${rgb(tone)}">${week}</span> ${days.map(
            (day) => html`<span class="cell" style="${isOutside(row, day) ? `color:${rgb(tone)}` : ''}">${day}</span>`,
          )}`,
      )}
    </div>
    <div class="ratios">${ratio('outside and week', contrast(tone, surface.background))}</div>
  </section>`;
};

export const sheet = (treatment: Treatment) =>
  html`<div class="sheet">
    ${[SURFACES['light']!, SURFACES['lightElevated']!, SURFACES['dark']!, SURFACES['darkElevated']!].map((s) =>
      panel(treatment, s),
    )}
  </div>`;

export const frameStyles = css`
  ${baseStyles}
  .sheet {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(8, 32px);
    row-gap: 2px;
  }
  .cell {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    block-size: 32px;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
  .week {
    font-size: 11px;
  }
`;
