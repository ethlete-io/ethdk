import { css, drawing, html } from '@design-explore';
import { BORDER, LINKS, MUTED, NODES, frameStyles, header } from './fixture';

const label = (id: string) => NODES.find((node) => node.id === id)?.label ?? id;

export default drawing({
  body: html`
    ${header}
    <table class="table">
      <thead>
        <tr>
          <th scope="col">From</th>
          <th scope="col">To</th>
          <th class="num" scope="col">Visitors</th>
        </tr>
      </thead>
      <tbody>
        ${LINKS.map(
          (link) =>
            html`<tr>
              <th scope="row">${label(link.source)}</th>
              <td>${label(link.target)}</td>
              <td class="num">${link.value}</td>
            </tr>`,
        )}
      </tbody>
    </table>
    <p class="note">
      Below 480px the chart hides its plot and shows the data table it already carries for screen readers.
    </p>
  `,
  styles: css`
    ${frameStyles}

    .table {
      width: 100%;
      border-collapse: collapse;
      font-variant-numeric: tabular-nums;
    }

    .table th,
    .table td {
      padding: 6px 4px;
      border-bottom: 1px solid ${BORDER};
      text-align: start;
      font-weight: 400;
    }

    .table thead th {
      color: ${MUTED};
      font-weight: 600;
    }

    .table .num {
      text-align: end;
    }
  `,
});
