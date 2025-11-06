import { BracketElementSpanCoordinates } from './bracket-element';
import { BracketMasterColumn } from './bracket-master-column';
import { Dimensions } from './types';

export type BracketGrid<TRoundData, TMatchData> = {
  masterColumns: ReadonlyArray<BracketMasterColumn<TRoundData, TMatchData>>;
  dimensions: Dimensions;
};

export type MutableBracketGrid<TRoundData, TMatchData> = {
  grid: BracketGrid<TRoundData, TMatchData>;
  pushMasterColumn: (...masterColumns: BracketMasterColumn<TRoundData, TMatchData>[]) => void;
  calculateDimensions: () => void;
  setupElementSpans: () => void;
};

export const createBracketGrid = <TRoundData, TMatchData>(config: {
  spanElementWidth: number;
}): MutableBracketGrid<TRoundData, TMatchData> => {
  const masterColumns: BracketMasterColumn<TRoundData, TMatchData>[] = [];
  const spannedWidthCache = new Map<string, number>();
  const spanStartLeftCache = new Map<string, number>();

  const newGrid: BracketGrid<TRoundData, TMatchData> = {
    dimensions: { width: 0, height: 0, top: 0, left: 0 },
    masterColumns,
  };

  const pushMasterColumn = (...newMasterColumns: BracketMasterColumn<TRoundData, TMatchData>[]) => {
    masterColumns.push(...newMasterColumns);
  };

  const calculateDimensions = () => {
    let currentMasterColumnLeft = 0;
    let maxGridHeight = 0;
    const masterCols = newGrid.masterColumns;

    for (let mcIdx = 0; mcIdx < masterCols.length; mcIdx++) {
      const masterColumn = masterCols[mcIdx]!;
      const { padding } = masterColumn;

      masterColumn.dimensions.left = currentMasterColumnLeft;
      masterColumn.dimensions.top = 0;
      masterColumn.dimensions.width += padding.left + padding.right;

      const sections = masterColumn.sections;
      let runningTop = 0;

      let firstSectionIsHeader = false;
      if (sections.length > 0) {
        const firstSubColumn = sections[0]!.subColumns[0];
        const firstElement = firstSubColumn?.elements[0];
        firstSectionIsHeader = !!(firstElement && firstElement.type === 'header');
      }

      for (let secIdx = 0; secIdx < sections.length; secIdx++) {
        const section = sections[secIdx]!;

        let sectionPaddingTop: number;
        if (secIdx === 0) {
          sectionPaddingTop = firstSectionIsHeader ? 0 : padding.top;
        } else {
          sectionPaddingTop = padding.top;
        }

        section.dimensions.width = masterColumn.dimensions.width;
        section.dimensions.left = masterColumn.dimensions.left;
        section.dimensions.top = runningTop;

        runningTop += sectionPaddingTop;

        const contentWidth = masterColumn.dimensions.width - padding.left - padding.right;
        const subColumns = section.subColumns;
        const totalSubColumns = subColumns.length;
        const subColumnWidth = contentWidth / totalSubColumns;
        let currentSubColumnLeft = masterColumn.dimensions.left + padding.left;
        let maxSectionHeight = 0;

        for (let scIdx = 0; scIdx < totalSubColumns; scIdx++) {
          const subColumn = subColumns[scIdx]!;
          subColumn.dimensions.width = subColumnWidth;
          subColumn.dimensions.left = currentSubColumnLeft;

          // TODO: The problem is here somewhere
          subColumn.dimensions.top = section.dimensions.top + sectionPaddingTop;

          let totalSubColumnHeight = 0;
          const elements = subColumn.elements;

          for (let elIdx = 0; elIdx < elements.length; elIdx++) {
            const element = elements[elIdx]!;
            let totalElementHeight = 0;
            const parts = element.parts;

            for (let pIdx = 0; pIdx < parts.length; pIdx++) {
              const part = parts[pIdx]!;
              part.dimensions.width = subColumnWidth;
              part.dimensions.left = currentSubColumnLeft;
              part.dimensions.top = subColumn.dimensions.top + totalSubColumnHeight + totalElementHeight;
              totalElementHeight += part.dimensions.height;
            }

            element.containerDimensions.height = totalElementHeight;
            element.containerDimensions.width = subColumnWidth;
            element.containerDimensions.left = currentSubColumnLeft;
            element.containerDimensions.top = subColumn.dimensions.top + totalSubColumnHeight;

            element.dimensions.width = subColumnWidth;
            element.dimensions.left = currentSubColumnLeft;
            element.dimensions.top =
              element.containerDimensions.top + (totalElementHeight - element.dimensions.height) * 0.5;

            totalSubColumnHeight += totalElementHeight;
          }

          subColumn.dimensions.height = totalSubColumnHeight;
          if (totalSubColumnHeight > maxSectionHeight) maxSectionHeight = totalSubColumnHeight;
          currentSubColumnLeft += subColumnWidth;
        }

        section.dimensions.height = maxSectionHeight + padding.bottom;

        runningTop += maxSectionHeight + padding.bottom;
      }

      masterColumn.dimensions.height = runningTop;
      if (masterColumn.dimensions.height > maxGridHeight) maxGridHeight = masterColumn.dimensions.height;
      currentMasterColumnLeft += masterColumn.dimensions.width;
    }

    newGrid.dimensions.width = currentMasterColumnLeft;
    newGrid.dimensions.height = maxGridHeight;

    calculateSpanningElementDimensions();
  };

  const calculateSpanningElementDimensions = () => {
    const spanDimensions = new Map<string, { width: number; left: number }>();
    const masterCols = newGrid.masterColumns;

    for (let mcIdx = 0; mcIdx < masterCols.length; mcIdx++) {
      const masterColumn = masterCols[mcIdx]!;
      const sections = masterColumn.sections;

      for (let secIdx = 0; secIdx < sections.length; secIdx++) {
        const section = sections[secIdx]!;
        const subColumns = section.subColumns;

        for (let scIdx = 0; scIdx < subColumns.length; scIdx++) {
          const subColumn = subColumns[scIdx]!;
          const elements = subColumn.elements;

          for (let elIdx = 0; elIdx < elements.length; elIdx++) {
            const element = elements[elIdx]!;
            if (!element.span) continue;

            const span = element.span;
            const isStartPosition =
              mcIdx === span.masterColumnStart && secIdx === span.sectionStart && scIdx === span.subColumnStart;

            const spanKey = `${span.masterColumnStart}-${span.masterColumnEnd}-${span.sectionStart}-${span.sectionEnd}-${span.subColumnStart}-${span.subColumnEnd}`;

            if (isStartPosition && !spanDimensions.has(spanKey)) {
              const totalSpannedWidth = calculateSpannedWidth(span, masterCols);
              const spanStartLeft = calculateSpanStartLeft(span, masterCols);
              const width = config.spanElementWidth;
              spanDimensions.set(spanKey, { width, left: spanStartLeft + (totalSpannedWidth - width) * 0.5 });
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
    span: BracketElementSpanCoordinates,
    masterColumns: ReadonlyArray<BracketMasterColumn<TRoundData, TMatchData>>,
  ): number => {
    const key = `${span.masterColumnStart}-${span.masterColumnEnd}-${span.sectionStart}-${span.sectionEnd}-${span.subColumnStart}-${span.subColumnEnd}`;
    if (spannedWidthCache.has(key)) return spannedWidthCache.get(key)!;

    if (span.masterColumnStart === span.masterColumnEnd) {
      const masterColumn = masterColumns[span.masterColumnStart];
      if (masterColumn) {
        const section = masterColumn.sections[span.sectionStart];
        if (section) {
          const subColumnWidth = section.dimensions.width / section.subColumns.length;
          const totalWidth = subColumnWidth * (span.subColumnEnd - span.subColumnStart + 1);
          spannedWidthCache.set(key, totalWidth);
          return totalWidth;
        }
      }
      spannedWidthCache.set(key, 0);
      return 0;
    }

    let totalWidth = 0;
    for (let mcIdx = span.masterColumnStart; mcIdx <= span.masterColumnEnd; mcIdx++) {
      const masterColumn = masterColumns[mcIdx];
      if (!masterColumn) continue;

      if (mcIdx === span.masterColumnStart) {
        const section = masterColumn.sections[span.sectionStart];
        if (section) {
          const subColumnWidth = section.dimensions.width / section.subColumns.length;
          totalWidth += subColumnWidth * (section.subColumns.length - span.subColumnStart);
        }
      } else if (mcIdx === span.masterColumnEnd) {
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
    span: BracketElementSpanCoordinates,
    masterColumns: ReadonlyArray<BracketMasterColumn<TRoundData, TMatchData>>,
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
      startLeft += (section.dimensions.width / section.subColumns.length) * span.subColumnStart;
    }

    spanStartLeftCache.set(key, startLeft);
    return startLeft;
  };

  const setupElementSpans = () => {
    const masterCols = newGrid.masterColumns;
    for (let mcIdx = 0; mcIdx < masterCols.length; mcIdx++) {
      const masterColumn = masterCols[mcIdx]!;
      const sections = masterColumn.sections;

      for (let secIdx = 0; secIdx < sections.length; secIdx++) {
        const section = sections[secIdx]!;
        const subColumns = section.subColumns;

        for (let scIdx = 0; scIdx < subColumns.length; scIdx++) {
          const subColumn = subColumns[scIdx]!;
          if (subColumn.span.isStart && subColumn.span.isEnd) continue;

          let spanStart = { masterColumnIndex: mcIdx, sectionIndex: secIdx, subColumnIndex: scIdx };
          if (!subColumn.span.isStart) {
            outer: for (let m = mcIdx; m >= 0; m--) {
              const mc = masterCols[m];
              if (!mc) continue;
              const sec = mc.sections[secIdx];
              if (!sec) continue;
              const end = m === mcIdx ? scIdx : sec.subColumns.length - 1;
              for (let s = end; s >= 0; s--) {
                if (sec.subColumns[s]?.span.isStart) {
                  spanStart = { masterColumnIndex: m, sectionIndex: secIdx, subColumnIndex: s };
                  break outer;
                }
              }
            }
          }

          let spanEnd = { masterColumnIndex: mcIdx, sectionIndex: secIdx, subColumnIndex: scIdx };
          if (!subColumn.span.isEnd) {
            outer: for (let m = mcIdx; m < masterCols.length; m++) {
              const mc = masterCols[m];
              if (!mc) continue;
              const sec = mc.sections[secIdx];
              if (!sec) continue;
              const start = m === mcIdx ? scIdx : 0;
              for (let s = start; s < sec.subColumns.length; s++) {
                if (sec.subColumns[s]?.span.isEnd) {
                  spanEnd = { masterColumnIndex: m, sectionIndex: secIdx, subColumnIndex: s };
                  break outer;
                }
              }
            }
          }

          const elements = subColumn.elements;
          for (let elIdx = 0; elIdx < elements.length; elIdx++) {
            elements[elIdx]!.span = {
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
