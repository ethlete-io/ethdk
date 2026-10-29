import { html } from '@design-system';
import type { GridRow, StateGridDrawing } from './shared/many-states';
import styles from './state-grid.css?inline';

const perLine = 4;

const restOnly = (row: GridRow) => row.cells.every((cell, index) => index === 0 || cell === undefined);

const label = (text: string) => `<span class="st-sgrid-label">${text}</span>`;
const cell = (body: string | undefined) => `<div class="st-sgrid-cell">${body ?? ''}</div>`;

const tableRow = ({ label: text, cells }: GridRow) =>
  `<span class="st-sgrid-row">${text}</span>` + cells.map(cell).join('');

const packedLine = (rows: GridRow[]) => {
  const blanks = '<span></span>'.repeat(perLine - rows.length);
  return (
    '<span></span>' +
    rows.map((row) => label(row.label)).join('') +
    blanks +
    '<span></span>' +
    rows.map((row) => cell(row.cells[0])).join('') +
    blanks
  );
};

const lines = (rows: GridRow[]) =>
  Array.from({ length: Math.ceil(rows.length / perLine) }, (_, index) =>
    rows.slice(index * perLine, (index + 1) * perLine),
  );

export const stateGrid = ({ columns, rows }: StateGridDrawing) => {
  const interactive = rows.filter((row) => !restOnly(row));
  const rest = rows.filter(restOnly);
  return {
    body: html`<div class="st-sgrid" style="--st-cols: ${columns.length}">
      <div class="st-sgrid-group">
        <span class="st-sgrid-head">States by interaction</span>
        <span></span>
        ${columns.map(label).join('')} ${interactive.map(tableRow).join('')}
      </div>
      <div class="st-sgrid-group st-sgrid-packed">
        <span class="st-sgrid-head">Rest only</span>
        ${lines(rest).map(packedLine).join('')}
      </div>
    </div>`,
    styles,
  };
};
