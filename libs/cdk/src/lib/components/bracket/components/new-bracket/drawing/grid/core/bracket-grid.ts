import { BracketGrid, BracketMasterColumn } from './types';

export type MutableBracketGrid = {
  grid: BracketGrid;
  pushMasterColumn: (element: BracketMasterColumn) => void;
  calculateDimensions: () => void;
};

export const createBracketGrid = (): MutableBracketGrid => {
  const masterColumns: BracketMasterColumn[] = [];

  const newGrid: BracketGrid = {
    dimensions: {
      width: 0,
      height: 0,
      top: 0,
      left: 0,
    },
    masterColumns,
  };

  const pushMasterColumn = (element: BracketMasterColumn) => {
    masterColumns.push(element);
  };

  const calculateDimensions = () => {
    let currentMasterColumnLeft = 0;
    let maxGridHeight = 0;

    for (const masterColumn of newGrid.masterColumns) {
      let maxMasterColumnHeight = 0;
      let currentSectionTop = 0;

      // Set master column horizontal position
      masterColumn.dimensions.left = currentMasterColumnLeft;
      masterColumn.dimensions.top = 0;

      for (const section of masterColumn.sections) {
        const totalSubColumns = section.subColumns.length;
        const subColumnWidth = section.dimensions.width / totalSubColumns;
        let currentSubColumnLeft = currentMasterColumnLeft;
        let maxSectionHeight = 0;

        // Set section position
        section.dimensions.left = currentMasterColumnLeft;
        section.dimensions.top = currentSectionTop;

        for (const subColumn of section.subColumns) {
          let totalSubColumnHeight = 0;
          let currentElementTop = currentSectionTop;

          // Set sub-column dimensions and position
          subColumn.dimensions.width = subColumnWidth;
          subColumn.dimensions.left = currentSubColumnLeft;
          subColumn.dimensions.top = currentSectionTop;

          for (const element of subColumn.elements) {
            let totalElementHeight = 0;
            let currentPartTop = currentElementTop;

            // Calculate parts dimensions and positions
            for (const part of element.parts) {
              part.dimensions.width = subColumnWidth;
              part.dimensions.left = currentSubColumnLeft;
              part.dimensions.top = currentPartTop;

              currentPartTop += part.dimensions.height;
              totalElementHeight += part.dimensions.height;
            }

            // Set element container dimensions
            element.containerDimensions.height = totalElementHeight;
            element.containerDimensions.width = subColumnWidth;
            element.containerDimensions.left = currentSubColumnLeft;
            element.containerDimensions.top = currentElementTop;

            // Set element visual dimensions (centered within container)
            element.dimensions.width = subColumnWidth;
            element.dimensions.left = currentSubColumnLeft;

            const elementHalfHeight = element.dimensions.height / 2;
            const containerCenter = currentElementTop + totalElementHeight / 2;
            element.dimensions.top = containerCenter - elementHalfHeight;

            currentElementTop += totalElementHeight;
            totalSubColumnHeight += totalElementHeight;
          }

          // Set sub-column height
          subColumn.dimensions.height = totalSubColumnHeight;

          // Track maximum height within this section
          maxSectionHeight = Math.max(maxSectionHeight, totalSubColumnHeight);
          currentSubColumnLeft += subColumnWidth;
        }

        // Set section height based on tallest sub-column
        section.dimensions.height = maxSectionHeight;

        // Sections stack vertically within the master column
        currentSectionTop += maxSectionHeight;
        maxMasterColumnHeight += maxSectionHeight;
      }

      // Set master column dimensions
      masterColumn.dimensions.height = maxMasterColumnHeight;

      // Track maximum grid height and advance horizontal position
      maxGridHeight = Math.max(maxGridHeight, maxMasterColumnHeight);
      currentMasterColumnLeft += masterColumn.dimensions.width;
    }

    // Set final grid dimensions
    newGrid.dimensions.width = currentMasterColumnLeft;
    newGrid.dimensions.height = maxGridHeight;
  };

  return {
    grid: newGrid,
    pushMasterColumn,
    calculateDimensions,
  };
};
