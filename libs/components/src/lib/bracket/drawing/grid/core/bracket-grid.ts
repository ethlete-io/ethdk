import { DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE } from '../../../core';
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

    for (const masterColumn of masterCols) {
      const { padding } = masterColumn;

      masterColumn.dimensions.left = currentMasterColumnLeft;
      masterColumn.dimensions.top = 0;
      masterColumn.dimensions.width += padding.left + padding.right;

      const sections = masterColumn.sections;
      let runningTop = 0;

      const firstElement = sections[0]?.subColumns[0]?.elements[0];
      const firstSectionIsHeader = firstElement?.type === 'header';

      for (const [secIdx, section] of sections.entries()) {
        const sectionPadding = section.padding ?? padding;

        let sectionPaddingTop: number;
        if (secIdx === 0) {
          sectionPaddingTop = firstSectionIsHeader ? 0 : sectionPadding.top;
        } else {
          sectionPaddingTop = sectionPadding.top;
        }

        section.dimensions.width = masterColumn.dimensions.width;
        section.dimensions.left = masterColumn.dimensions.left;
        section.dimensions.top = runningTop;

        runningTop += sectionPaddingTop;

        const contentWidth = masterColumn.dimensions.width - sectionPadding.left - sectionPadding.right;
        const subColumns = section.subColumns;
        const totalSubColumns = subColumns.length;
        const subColumnWidth = contentWidth / totalSubColumns;
        let currentSubColumnLeft = masterColumn.dimensions.left + sectionPadding.left;
        let maxSectionHeight = 0;

        for (const subColumn of subColumns) {
          subColumn.dimensions.width = subColumnWidth;
          subColumn.dimensions.left = currentSubColumnLeft;

          // TODO: The problem is here somewhere
          subColumn.dimensions.top = section.dimensions.top + sectionPaddingTop;

          let totalSubColumnHeight = 0;
          const elements = subColumn.elements;

          for (const element of elements) {
            let totalElementHeight = 0;
            const parts = element.parts;

            for (const part of parts) {
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

        section.dimensions.height = maxSectionHeight + sectionPadding.bottom;

        runningTop += maxSectionHeight + sectionPadding.bottom;
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

    for (const [mcIdx, masterColumn] of masterCols.entries()) {
      const sections = masterColumn.sections;

      for (const [secIdx, section] of sections.entries()) {
        const subColumns = section.subColumns;

        for (const [scIdx, subColumn] of subColumns.entries()) {
          const elements = subColumn.elements;

          for (const element of elements) {
            if (!element.span) continue;

            const span = element.span;
            const isStartPosition =
              mcIdx === span.masterColumnStart && secIdx === span.sectionStart && scIdx === span.subColumnStart;

            const spanKey = `${span.masterColumnStart}-${span.masterColumnEnd}-${span.sectionStart}-${span.sectionEnd}-${span.subColumnStart}-${span.subColumnEnd}`;

            if (isStartPosition && !spanDimensions.has(spanKey)) {
              const totalSpannedWidth = calculateSpannedWidth(span, masterCols);
              const spanStartLeft = calculateSpanStartLeft(span, masterCols);
              const width = config.spanElementWidth;

              // Winner bracket rounds span two lower bracket columns. Left-align them within that
              // span (factor 0) instead of centering (factor 0.5) so each winner round n sits above
              // the lower bracket round its losers drop into (round 2n-2) — the round whose matches
              // merge into the next one. That makes the participant's drop target unambiguous. Every
              // other spanning round (e.g. lower rounds split across sub-columns) stays centered.
              const round = element.type === 'header' || element.type === 'match' ? element.round : null;
              const alignFactor = round?.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET ? 0 : 0.5;

              spanDimensions.set(spanKey, { width, left: spanStartLeft + (totalSpannedWidth - width) * alignFactor });
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
  ) => {
    const key = `${span.masterColumnStart}-${span.masterColumnEnd}-${span.sectionStart}-${span.sectionEnd}-${span.subColumnStart}-${span.subColumnEnd}`;
    const cachedWidth = spannedWidthCache.get(key);

    if (cachedWidth !== undefined) return cachedWidth;

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
  ) => {
    const key = `${span.masterColumnStart}-${span.sectionStart}-${span.subColumnStart}`;
    const cachedLeft = spanStartLeftCache.get(key);

    if (cachedLeft !== undefined) return cachedLeft;

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
    for (const [mcIdx, masterColumn] of masterCols.entries()) {
      const sections = masterColumn.sections;

      for (const [secIdx, section] of sections.entries()) {
        const subColumns = section.subColumns;

        for (const [scIdx, subColumn] of subColumns.entries()) {
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
          for (const element of elements) {
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
