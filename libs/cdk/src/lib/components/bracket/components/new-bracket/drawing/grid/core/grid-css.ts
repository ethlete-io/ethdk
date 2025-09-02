import { BracketElement } from './bracket-element';
import { BracketMasterColumn } from './bracket-master-column';

export function logGridAreasFormatted(gridTemplateAreas: string): void {
  if (!gridTemplateAreas) {
    console.log('No grid areas to display');
    return;
  }

  // Parse the grid template areas string
  const rows = gridTemplateAreas
    .split('\n')
    .map((row) => row.replace(/^"/, '').replace(/"$/, '')) // Remove quotes
    .map((row) => row.split(' ')); // Split into individual areas

  if (rows.length === 0) {
    console.log('No grid areas to display');
    return;
  }

  // Find the maximum width for each column to align properly
  const columnCount = rows[0]?.length ?? 0;
  const columnWidths: number[] = [];

  for (let colIndex = 0; colIndex < columnCount; colIndex++) {
    const maxWidth = Math.max(...rows.map((row) => (row[colIndex] || '').length));
    columnWidths.push(Math.max(maxWidth, 3)); // Minimum width of 3
  }

  console.log('\n📋 Grid Template Areas (Formatted):');
  console.log('═'.repeat(columnWidths.reduce((sum, width) => sum + width + 3, 0)));

  // Log each row with proper spacing
  rows.forEach((row, rowIndex) => {
    const formattedRow = row
      .map((area, colIndex) => {
        const width = columnWidths[colIndex] ?? 0;
        return area.padEnd(width);
      })
      .join(' | ');

    console.log(`${String(rowIndex).padStart(2, '0')}: ${formattedRow}`);
  });

  console.log('═'.repeat(columnWidths.reduce((sum, width) => sum + width + 3, 0)));
  console.log(`📊 Grid dimensions: ${rows.length} rows × ${columnCount} columns\n`);
}

export function gridColumnsToGridProperty(grid: ReadonlyArray<BracketMasterColumn<any, any>>) {
  if (!grid.length) {
    return {
      gridTemplateAreas: '',
      gridTemplateRows: '',
      gridTemplateColumns: '',
    };
  }

  // Calculate the total number of columns (subcolumns across all master columns)
  const totalColumns = grid.reduce((total, masterColumn) => {
    return total + Math.max(...masterColumn.sections.map((section) => section.subColumns.length));
  }, 0);

  // Find all unique sections across all master columns to determine rows
  const allSections: Array<{
    elements: ReadonlyArray<BracketElement<any, any>>;
    sectionIndex: number;
    masterColumnIndex: number;
  }> = [];

  grid.forEach((masterColumn, masterColumnIndex) => {
    masterColumn.sections.forEach((section, sectionIndex) => {
      // For each section, we need to process all its subcolumns
      section.subColumns.forEach((subColumn) => {
        allSections.push({
          elements: subColumn.elements,
          sectionIndex,
          masterColumnIndex,
        });
      });
    });
  });

  // Group sections by their index to create rows
  const sectionsByIndex = new Map<
    number,
    Array<{
      elements: ReadonlyArray<BracketElement<any, any>>;
      columnIndex: number;
      masterColumnIndex: number;
    }>
  >();

  let globalColumnIndex = 0;
  grid.forEach((masterColumn, masterColumnIndex) => {
    const maxSubColumns = Math.max(...masterColumn.sections.map((section) => section.subColumns.length));

    masterColumn.sections.forEach((section, sectionIndex) => {
      if (!sectionsByIndex.has(sectionIndex)) {
        sectionsByIndex.set(sectionIndex, []);
      }

      section.subColumns.forEach((subColumn, subColumnIndex) => {
        sectionsByIndex.get(sectionIndex)!.push({
          elements: subColumn.elements,
          columnIndex: globalColumnIndex + subColumnIndex,
          masterColumnIndex,
        });
      });
    });

    globalColumnIndex += maxSubColumns;
  });

  // Build the grid matrix - sections become rows, subcolumns become columns
  const areaMatrix: string[][] = [];
  const rowHeights: string[] = [];

  // Process each section (which becomes a row group)
  for (const [sectionIndex, sectionColumns] of sectionsByIndex.entries()) {
    // Find max rows needed for this section
    const maxRowsInSection = Math.max(
      ...sectionColumns.map((col) => col.elements.reduce((total, element) => total + element.parts.length, 0)),
      0,
    );

    // Create rows for this section
    for (let rowIndex = 0; rowIndex < maxRowsInSection; rowIndex++) {
      const areaRow: string[] = new Array(totalColumns).fill('.');
      let currentRowHeight: string | undefined;

      // Fill in areas for each column in this section
      for (const sectionColumn of sectionColumns) {
        let accumulatedRows = 0;
        let area = '.';
        let height: number | undefined;

        // Find which element this row belongs to
        for (const element of sectionColumn.elements) {
          const elementRowCount = element.parts.length;

          if (rowIndex >= accumulatedRows && rowIndex < accumulatedRows + elementRowCount) {
            const relativeRowIndex = rowIndex - accumulatedRows;
            area = element.area;
            height = element.parts[relativeRowIndex]?.dimensions.height;
            break;
          }

          accumulatedRows += elementRowCount;
        }

        areaRow[sectionColumn.columnIndex] = area;

        // Use the first defined height for this row
        if (!currentRowHeight && height !== undefined) {
          currentRowHeight = `${height}px`;
        }
      }

      areaMatrix.push(areaRow);
      rowHeights.push(currentRowHeight ?? 'auto');
    }
  }

  // Calculate column widths
  const columnWidths: string[] = [];

  for (const masterColumn of grid) {
    const maxSubColumns = Math.max(...masterColumn.sections.map((section) => section.subColumns.length));

    for (let i = 0; i < maxSubColumns; i++) {
      // Find the width from any section that has this subcolumn
      const subColumnWidth =
        masterColumn.sections.find((section) => section.subColumns[i])?.subColumns[i]?.dimensions.width ?? 0;

      columnWidths.push(`${subColumnWidth}px`);
    }
  }

  // Build the CSS properties
  const gridTemplateAreas = areaMatrix.map((row) => `"${row.join(' ')}"`).join('\n');
  const gridTemplateRows = rowHeights.join(' ');
  const gridTemplateColumns = columnWidths.join(' ');

  const result = {
    gridTemplateAreas,
    gridTemplateRows,
    gridTemplateColumns,
  };

  logGridAreasFormatted(gridTemplateAreas);

  return result;
}
