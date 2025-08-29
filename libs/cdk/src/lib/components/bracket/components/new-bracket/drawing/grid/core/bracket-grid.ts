import { BracketElement, BracketGrid, BracketMasterColumn } from './types';

export type MutableBracketGrid = {
  grid: BracketGrid;
  pushMasterColumn: (...masterColumns: BracketMasterColumn[]) => void;
  calculateDimensions: () => void;
  setupElementSpans: () => void;
};

export const createBracketGrid = (config: { spanElementWidth: number }): MutableBracketGrid => {
  const masterColumns: BracketMasterColumn[] = [];

  const spannedWidthCache = new Map<string, number>();
  const spanStartLeftCache = new Map<string, number>();

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
      masterColumn.dimensions.left = currentMasterColumnLeft;
      masterColumn.dimensions.top = 0;

      let maxMasterColumnHeight = 0;
      let currentSectionTop = 0;

      for (const section of masterColumn.sections) {
        section.dimensions.width = masterColumn.dimensions.width;
        section.dimensions.left = currentMasterColumnLeft;
        section.dimensions.top = currentSectionTop;

        const totalSubColumns = section.subColumns.length;
        const subColumnWidth = section.dimensions.width / totalSubColumns;
        let currentSubColumnLeft = currentMasterColumnLeft;
        let maxSectionHeight = 0;

        for (const subColumn of section.subColumns) {
          subColumn.dimensions.width = subColumnWidth;
          subColumn.dimensions.left = currentSubColumnLeft;
          subColumn.dimensions.top = currentSectionTop;

          let totalSubColumnHeight = 0;

          for (const element of subColumn.elements) {
            let totalElementHeight = 0;

            for (const part of element.parts) {
              part.dimensions.width = subColumnWidth;
              part.dimensions.left = currentSubColumnLeft;
              part.dimensions.top = element.containerDimensions.top + totalElementHeight;
              totalElementHeight += part.dimensions.height;
            }

            element.containerDimensions.height = totalElementHeight;
            element.containerDimensions.width = subColumnWidth;
            element.containerDimensions.left = currentSubColumnLeft;
            element.containerDimensions.top = subColumn.dimensions.top + totalSubColumnHeight;

            element.dimensions.width = subColumnWidth;
            element.dimensions.left = currentSubColumnLeft;
            element.dimensions.top =
              element.containerDimensions.top + (totalElementHeight - element.dimensions.height) / 2;

            totalSubColumnHeight += totalElementHeight;
          }

          subColumn.dimensions.height = totalSubColumnHeight;
          maxSectionHeight = Math.max(maxSectionHeight, totalSubColumnHeight);
          currentSubColumnLeft += subColumnWidth;
        }

        section.dimensions.height = maxSectionHeight;
        currentSectionTop += maxSectionHeight;
        maxMasterColumnHeight += maxSectionHeight;
      }

      masterColumn.dimensions.height = maxMasterColumnHeight;
      maxGridHeight = Math.max(maxGridHeight, maxMasterColumnHeight);
      currentMasterColumnLeft += masterColumn.dimensions.width;
    }

    newGrid.dimensions.width = currentMasterColumnLeft;
    newGrid.dimensions.height = maxGridHeight;

    calculateSpanningElementDimensions();
  };

  const calculateSpanningElementDimensions = () => {
    const spanDimensions = new Map<string, { width: number; left: number }>();

    for (let masterColumnIndex = 0; masterColumnIndex < newGrid.masterColumns.length; masterColumnIndex++) {
      const masterColumn = newGrid.masterColumns[masterColumnIndex]!;

      for (let sectionIndex = 0; sectionIndex < masterColumn.sections.length; sectionIndex++) {
        const section = masterColumn.sections[sectionIndex]!;

        for (let subColumnIndex = 0; subColumnIndex < section.subColumns.length; subColumnIndex++) {
          const subColumn = section.subColumns[subColumnIndex]!;

          for (const element of subColumn.elements) {
            if (!element.span) continue;

            const isStartPosition =
              masterColumnIndex === element.span.masterColumnStart &&
              sectionIndex === element.span.sectionStart &&
              subColumnIndex === element.span.subColumnStart;

            const spanKey = `${element.span.masterColumnStart}-${element.span.masterColumnEnd}-${element.span.sectionStart}-${element.span.sectionEnd}-${element.span.subColumnStart}-${element.span.subColumnEnd}`;

            if (isStartPosition && !spanDimensions.has(spanKey)) {
              const totalSpannedWidth = calculateSpannedWidth(element.span, newGrid.masterColumns);
              const spanStartLeft = calculateSpanStartLeft(element.span, newGrid.masterColumns);
              const width = config.spanElementWidth;
              const centerOffset = (totalSpannedWidth - width) / 2;
              spanDimensions.set(spanKey, { width, left: spanStartLeft + centerOffset });
            }

            const storedDimensions = spanDimensions.get(spanKey);
            if (storedDimensions) {
              element.dimensions.width = storedDimensions.width;
              element.dimensions.left = storedDimensions.left;
              element.isHidden = !isStartPosition;
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
    const key = `${span.masterColumnStart}-${span.masterColumnEnd}-${span.sectionStart}-${span.sectionEnd}-${span.subColumnStart}-${span.subColumnEnd}`;
    if (spannedWidthCache.has(key)) return spannedWidthCache.get(key)!;

    if (span.masterColumnStart === span.masterColumnEnd) {
      const masterColumn = masterColumns[span.masterColumnStart];
      if (masterColumn) {
        const section = masterColumn.sections[span.sectionStart];
        if (section) {
          const subColumnWidth = section.dimensions.width / section.subColumns.length;
          const subColumnsSpanned = span.subColumnEnd - span.subColumnStart + 1;
          const totalWidth = subColumnWidth * subColumnsSpanned;
          spannedWidthCache.set(key, totalWidth);
          return totalWidth;
        }
      }
      spannedWidthCache.set(key, 0);
      return 0;
    }

    let totalWidth = 0;
    for (
      let masterColumnIndex = span.masterColumnStart;
      masterColumnIndex <= span.masterColumnEnd;
      masterColumnIndex++
    ) {
      const masterColumn = masterColumns[masterColumnIndex];
      if (!masterColumn) continue;

      if (masterColumnIndex === span.masterColumnStart) {
        const section = masterColumn.sections[span.sectionStart];
        if (section) {
          const subColumnWidth = section.dimensions.width / section.subColumns.length;
          totalWidth += subColumnWidth * (section.subColumns.length - span.subColumnStart);
        }
      } else if (masterColumnIndex === span.masterColumnEnd) {
        const section = masterColumn.sections[span.sectionEnd];
        if (section) {
          const subColumnWidth = section.dimensions.width / section.subColumns.length;
          totalWidth += subColumnWidth * (span.subColumnEnd + 1);
        }
      } else {
        totalWidth += masterColumn.dimensions.width;
      }
    }
    spannedWidthCache.set(key, totalWidth);
    return totalWidth;
  };

  const calculateSpanStartLeft = (
    span: NonNullable<BracketElement['span']>,
    masterColumns: ReadonlyArray<BracketMasterColumn>,
  ): number => {
    const key = `${span.masterColumnStart}-${span.sectionStart}-${span.subColumnStart}`;
    if (spanStartLeftCache.has(key)) return spanStartLeftCache.get(key)!;

    const startMasterColumn = masterColumns[span.masterColumnStart];
    if (!startMasterColumn) {
      spanStartLeftCache.set(key, 0);
      return 0;
    }

    let startLeft = startMasterColumn.dimensions.left;
    const section = startMasterColumn.sections[span.sectionStart];
    if (section) {
      const subColumnWidth = section.dimensions.width / section.subColumns.length;
      startLeft += subColumnWidth * span.subColumnStart;
    }

    spanStartLeftCache.set(key, startLeft);
    return startLeft;
  };

  const setupElementSpans = () => {
    for (const [masterColumnIndex, masterColumn] of newGrid.masterColumns.entries()) {
      for (const [sectionIndex, section] of masterColumn.sections.entries()) {
        for (const [subColumnIndex, subColumn] of section.subColumns.entries()) {
          if (subColumn.span.isStart && subColumn.span.isEnd) continue;

          let spanStart = { masterColumnIndex, sectionIndex, subColumnIndex };
          if (!subColumn.span.isStart) {
            outer: for (let m = masterColumnIndex; m >= 0; m--) {
              const mc = newGrid.masterColumns[m];
              if (!mc) continue;
              const sec = mc.sections[sectionIndex];
              if (!sec) continue;
              const end = m === masterColumnIndex ? subColumnIndex : sec.subColumns.length - 1;
              for (let s = end; s >= 0; s--) {
                if (sec.subColumns[s]?.span.isStart) {
                  spanStart = { masterColumnIndex: m, sectionIndex, subColumnIndex: s };
                  break outer;
                }
              }
            }
          }

          let spanEnd = { masterColumnIndex, sectionIndex, subColumnIndex };
          if (!subColumn.span.isEnd) {
            outer: for (let m = masterColumnIndex; m < newGrid.masterColumns.length; m++) {
              const mc = newGrid.masterColumns[m];
              if (!mc) continue;
              const sec = mc.sections[sectionIndex];
              if (!sec) continue;
              const start = m === masterColumnIndex ? subColumnIndex : 0;
              for (let s = start; s < sec.subColumns.length; s++) {
                if (sec.subColumns[s]?.span.isEnd) {
                  spanEnd = { masterColumnIndex: m, sectionIndex, subColumnIndex: s };
                  break outer;
                }
              }
            }
          }

          for (const element of subColumn.elements) {
            element.span = {
              masterColumnStart: spanStart.masterColumnIndex,
              masterColumnEnd: spanEnd.masterColumnIndex,
              sectionStart: spanStart.sectionIndex,
              sectionEnd: spanEnd.sectionIndex,
              subColumnStart: spanStart.subColumnIndex,
              subColumnEnd: spanEnd.subColumnIndex,
            };
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
