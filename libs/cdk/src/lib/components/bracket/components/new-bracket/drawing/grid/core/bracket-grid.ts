import { BracketElement, BracketElementSpanCoordinates, BracketGrid, BracketMasterColumn } from './types';

export type MutableBracketGrid = {
  grid: BracketGrid;
  pushMasterColumn: (...masterColumns: BracketMasterColumn[]) => void;
  calculateDimensions: () => void;
  setupElementSpans: () => void;
};

export const createBracketGrid = (config: { spanElementWidth: number }): MutableBracketGrid => {
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

  const pushMasterColumn = (...newMasterColumns: BracketMasterColumn[]) => {
    masterColumns.push(...newMasterColumns);
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
        // Set section width based on master column width
        section.dimensions.width = masterColumn.dimensions.width;

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

    calculateSpanningElementDimensions();
  };

  const calculateSpanningElementDimensions = () => {
    // First pass: calculate dimensions for start elements and store them
    const spanDimensions = new Map<string, { width: number; left: number }>();

    for (let masterColumnIndex = 0; masterColumnIndex < newGrid.masterColumns.length; masterColumnIndex++) {
      const masterColumn = newGrid.masterColumns[masterColumnIndex]!;

      for (let sectionIndex = 0; sectionIndex < masterColumn.sections.length; sectionIndex++) {
        const section = masterColumn.sections[sectionIndex]!;

        for (let subColumnIndex = 0; subColumnIndex < section.subColumns.length; subColumnIndex++) {
          const subColumn = section.subColumns[subColumnIndex]!;

          for (const element of subColumn.elements) {
            if (element.span) {
              // Check if this is the START position of the span
              const isStartPosition =
                masterColumnIndex === element.span.masterColumnStart &&
                sectionIndex === element.span.sectionStart &&
                subColumnIndex === element.span.subColumnStart;

              if (isStartPosition) {
                // Calculate dimensions for the start element
                const totalSpannedWidth = calculateSpannedWidth(element.span, newGrid.masterColumns);
                const spanStartLeft = calculateSpanStartLeft(element.span, newGrid.masterColumns);

                const width = config.spanElementWidth;
                const centerOffset = (totalSpannedWidth - config.spanElementWidth) / 2;
                const left = spanStartLeft + centerOffset;

                // Set dimensions for start element
                element.dimensions.width = width;
                element.dimensions.left = left;
                element.isHidden = false;

                // Store dimensions for other elements in this span
                const spanKey = `${element.span.masterColumnStart}-${element.span.masterColumnEnd}-${element.span.sectionStart}-${element.span.sectionEnd}-${element.span.subColumnStart}-${element.span.subColumnEnd}`;
                spanDimensions.set(spanKey, { width, left });
              }
            }
          }
        }
      }
    }

    // Second pass: apply stored dimensions to all elements within spans
    for (let masterColumnIndex = 0; masterColumnIndex < newGrid.masterColumns.length; masterColumnIndex++) {
      const masterColumn = newGrid.masterColumns[masterColumnIndex]!;

      for (let sectionIndex = 0; sectionIndex < masterColumn.sections.length; sectionIndex++) {
        const section = masterColumn.sections[sectionIndex]!;

        for (let subColumnIndex = 0; subColumnIndex < section.subColumns.length; subColumnIndex++) {
          const subColumn = section.subColumns[subColumnIndex]!;

          for (const element of subColumn.elements) {
            if (element.span) {
              const isStartPosition =
                masterColumnIndex === element.span.masterColumnStart &&
                sectionIndex === element.span.sectionStart &&
                subColumnIndex === element.span.subColumnStart;

              if (!isStartPosition) {
                // This is not the start position, so apply the same dimensions as the start
                const spanKey = `${element.span.masterColumnStart}-${element.span.masterColumnEnd}-${element.span.sectionStart}-${element.span.sectionEnd}-${element.span.subColumnStart}-${element.span.subColumnEnd}`;
                const storedDimensions = spanDimensions.get(spanKey);

                if (storedDimensions) {
                  element.dimensions.width = storedDimensions.width;
                  element.dimensions.left = storedDimensions.left;
                  element.isHidden = true; // Still mark as hidden for rendering logic
                }
              }
            }
          }
        }
      }
    }
  };

  const calculateSpannedWidth = (
    span: NonNullable<BracketElement['span']>,
    masterColumns: ReadonlyArray<BracketMasterColumn>,
  ): number => {
    let totalWidth = 0;

    if (span.masterColumnStart === span.masterColumnEnd) {
      // Spanning within the same master column
      const masterColumn = masterColumns[span.masterColumnStart];
      if (masterColumn) {
        const section = masterColumn.sections[span.sectionStart];
        if (section) {
          const subColumnWidth = section.dimensions.width / section.subColumns.length;
          const subColumnsSpanned = span.subColumnEnd - span.subColumnStart + 1;
          totalWidth = subColumnWidth * subColumnsSpanned;
        }
      }
    } else {
      // Spanning across multiple master columns
      for (
        let masterColumnIndex = span.masterColumnStart;
        masterColumnIndex <= span.masterColumnEnd;
        masterColumnIndex++
      ) {
        const masterColumn = masterColumns[masterColumnIndex];
        if (!masterColumn) continue;

        if (masterColumnIndex === span.masterColumnStart) {
          // First master column - calculate from start sub-column to the end of the column
          const section = masterColumn.sections[span.sectionStart];
          if (section) {
            const subColumnWidth = section.dimensions.width / section.subColumns.length;
            const subColumnsFromStart = section.subColumns.length - span.subColumnStart;
            totalWidth += subColumnWidth * subColumnsFromStart;
          }
        } else if (masterColumnIndex === span.masterColumnEnd) {
          // Last master column - calculate from start of column to end sub-column
          const section = masterColumn.sections[span.sectionEnd];
          if (section) {
            const subColumnWidth = section.dimensions.width / section.subColumns.length;
            const subColumnsToEnd = span.subColumnEnd + 1;
            totalWidth += subColumnWidth * subColumnsToEnd;
          }
        } else {
          // Middle master columns - use full width
          totalWidth += masterColumn.dimensions.width;
        }
      }
    }

    return totalWidth;
  };

  const calculateSpanStartLeft = (
    span: NonNullable<BracketElement['span']>,
    masterColumns: ReadonlyArray<BracketMasterColumn>,
  ): number => {
    const startMasterColumn = masterColumns[span.masterColumnStart];
    if (!startMasterColumn) return 0;

    let startLeft = startMasterColumn.dimensions.left;

    // Add offset for sub-column position within the master column
    const section = startMasterColumn.sections[span.sectionStart];
    if (section) {
      const subColumnWidth = section.dimensions.width / section.subColumns.length;
      startLeft += subColumnWidth * span.subColumnStart;
    }

    return startLeft;
  };

  const setupElementSpans = () => {
    for (const [masterColumnIndex, masterColumn] of newGrid.masterColumns.entries()) {
      for (const [sectionIndex, section] of masterColumn.sections.entries()) {
        for (const [subColumnIndex, subColumn] of section.subColumns.entries()) {
          const isSpanStart = subColumn.span.isStart;
          const isSpanEnd = subColumn.span.isEnd;

          if (isSpanStart && isSpanEnd) {
            // Single column, no spanning needed
            continue;
          }

          // Find the start of the span by looking backwards
          let spanStart: { masterColumnIndex: number; sectionIndex: number; subColumnIndex: number } = {
            masterColumnIndex,
            sectionIndex,
            subColumnIndex,
          };

          if (!isSpanStart) {
            // Look backwards to find the start
            for (
              let checkMasterColumnIndex = masterColumnIndex;
              checkMasterColumnIndex >= 0;
              checkMasterColumnIndex--
            ) {
              const checkMasterColumn = newGrid.masterColumns[checkMasterColumnIndex]!;
              const checkSection = checkMasterColumn.sections[sectionIndex];
              if (!checkSection) break;

              const subColumnsToCheck =
                checkMasterColumnIndex === masterColumnIndex
                  ? subColumnIndex + 1 // For current master column, check up to current sub-column
                  : checkSection.subColumns.length; // For previous master columns, check all sub-columns

              for (let checkSubColumnIndex = subColumnsToCheck - 1; checkSubColumnIndex >= 0; checkSubColumnIndex--) {
                const checkSubColumn = checkSection.subColumns[checkSubColumnIndex]!;

                if (checkSubColumn.span.isStart) {
                  spanStart = {
                    masterColumnIndex: checkMasterColumnIndex,
                    sectionIndex,
                    subColumnIndex: checkSubColumnIndex,
                  };
                  break;
                }
              }

              // If we found the start, break out of the outer loop
              if (spanStart.masterColumnIndex !== masterColumnIndex || spanStart.subColumnIndex !== subColumnIndex) {
                break;
              }
            }
          }

          // Find the end of the span by looking forwards
          let spanEnd: { masterColumnIndex: number; sectionIndex: number; subColumnIndex: number } = {
            masterColumnIndex,
            sectionIndex,
            subColumnIndex,
          };

          if (!isSpanEnd) {
            // Look forwards to find the end
            for (
              let checkMasterColumnIndex = masterColumnIndex;
              checkMasterColumnIndex < newGrid.masterColumns.length;
              checkMasterColumnIndex++
            ) {
              const checkMasterColumn = newGrid.masterColumns[checkMasterColumnIndex]!;
              const checkSection = checkMasterColumn.sections[sectionIndex];
              if (!checkSection) break;

              const startSubColumnIndex =
                checkMasterColumnIndex === masterColumnIndex
                  ? subColumnIndex // For current master column, start from current sub-column
                  : 0; // For future master columns, start from beginning

              for (
                let checkSubColumnIndex = startSubColumnIndex;
                checkSubColumnIndex < checkSection.subColumns.length;
                checkSubColumnIndex++
              ) {
                const checkSubColumn = checkSection.subColumns[checkSubColumnIndex]!;

                if (checkSubColumn.span.isEnd) {
                  spanEnd = {
                    masterColumnIndex: checkMasterColumnIndex,
                    sectionIndex,
                    subColumnIndex: checkSubColumnIndex,
                  };
                  break;
                }
              }

              // If we found the end, break out of the outer loop
              if (spanEnd.masterColumnIndex !== masterColumnIndex || spanEnd.subColumnIndex !== subColumnIndex) {
                break;
              }
            }
          }

          // Apply span coordinates to all elements in this sub-column
          for (const element of subColumn.elements) {
            const spanCoordinates: BracketElementSpanCoordinates = {
              masterColumnStart: spanStart.masterColumnIndex,
              masterColumnEnd: spanEnd.masterColumnIndex,
              sectionStart: spanStart.sectionIndex,
              sectionEnd: spanEnd.sectionIndex,
              subColumnStart: spanStart.subColumnIndex,
              subColumnEnd: spanEnd.subColumnIndex,
            };

            element.span = spanCoordinates;
          }
        }
      }
    }
  };

  return {
    grid: newGrid,
    pushMasterColumn,
    calculateDimensions,
    setupElementSpans,
  };
};
