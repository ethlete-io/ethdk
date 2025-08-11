import { BracketMasterColumn } from './types';

export function gridColumnsToGridProperty(grid: ReadonlyArray<BracketMasterColumn>) {
  if (!grid.length) {
    return {
      gridTemplateAreas: '',
      gridTemplateRows: '',
      gridTemplateColumns: '',
    };
  }

  // Flatten all elements from all column sections and their subColumns
  const columnsElements = grid.map((col) =>
    col.sections.flatMap((section) => section.subColumns.flatMap((subCol) => subCol.elements)),
  );

  // Calculate total rows by expanding each element into its individual rows
  const maxRows = Math.max(
    ...columnsElements.map((elements) => elements.reduce((total, element) => total + element.parts.length, 0)),
    0, // fallback for empty arrays
  );

  // Build the grid matrix
  const areaMatrix: string[][] = [];
  const rowHeights: string[] = [];

  for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
    const areaRow: string[] = [];
    let currentRowHeight: string | undefined;

    for (let colIndex = 0; colIndex < grid.length; colIndex++) {
      const colElements = columnsElements[colIndex];

      // Find which element and specific row this position belongs to
      let area = '.';
      let height: number | undefined;
      let accumulatedRows = 0;

      if (colElements) {
        for (const element of colElements) {
          const elementRowCount = element.parts.length;

          if (rowIndex >= accumulatedRows && rowIndex < accumulatedRows + elementRowCount) {
            const relativeRowIndex = rowIndex - accumulatedRows;
            area = element.area;
            height = element.parts[relativeRowIndex]?.dimensions.height;
            break;
          }

          accumulatedRows += elementRowCount;
        }
      }

      areaRow.push(area);

      // Use the first defined height for this row across all columns
      if (!currentRowHeight && height !== undefined) {
        currentRowHeight = `${height}px`;
      }
    }

    areaMatrix.push(areaRow);
    rowHeights.push(currentRowHeight ?? 'auto');
  }

  // Build the CSS properties
  const gridTemplateAreas = areaMatrix.map((row) => `"${row.join(' ')}"`).join('\n');

  const gridTemplateRows = rowHeights.join(' ');

  const gridTemplateColumns = grid
    .map((col) => {
      const width = col.dimensions.width;
      return `${width}px`;
    })
    .join(' ');

  return {
    gridTemplateAreas,
    gridTemplateRows,
    gridTemplateColumns,
  };
}
