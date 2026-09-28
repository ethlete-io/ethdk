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
  const contentWidths = new WeakMap<BracketMasterColumn<TRoundData, TMatchData>, number>();

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
      const contentWidth = contentWidths.get(masterColumn) ?? masterColumn.dimensions.width;

      contentWidths.set(masterColumn, contentWidth);
      masterColumn.dimensions.width = contentWidth + padding.left + padding.right;

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

        const sectionContentWidth = masterColumn.dimensions.width - sectionPadding.left - sectionPadding.right;
        const subColumns = section.subColumns;
        const totalSubColumns = subColumns.length;
        const subColumnWidth = sectionContentWidth / totalSubColumns;
        let currentSubColumnLeft = masterColumn.dimensions.left + sectionPadding.left;
        let maxSectionHeight = 0;

        for (const subColumn of subColumns) {
          subColumn.dimensions.width = subColumnWidth;
          subColumn.dimensions.left = currentSubColumnLeft;
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

        // Never negative: a section may start above where it would stack (a folded third place asks for
        // that with a negative padding), but its own box still has to be a box.
        section.dimensions.height = Math.max(0, sectionPaddingTop + maxSectionHeight + sectionPadding.bottom);

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
              const { left: spanStartLeft, width: totalSpannedWidth } = calculateSpanExtent(span, masterCols);
              const width = config.spanElementWidth;

              // Winner bracket rounds span two lower bracket columns. Left-align them within that
              // span (factor 0) instead of centering (factor 0.5) so each winner round n sits above
              // the lower bracket round its losers drop into (round 2n-2) - the round whose matches
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

  const calculateSpanExtent = (
    span: BracketElementSpanCoordinates,
    masterColumns: ReadonlyArray<BracketMasterColumn<TRoundData, TMatchData>>,
  ) => {
    const start = masterColumns[span.masterColumnStart]?.sections[span.sectionStart]?.subColumns[span.subColumnStart];
    const end = masterColumns[span.masterColumnEnd]?.sections[span.sectionEnd]?.subColumns[span.subColumnEnd];

    if (!start || !end) return { left: start?.dimensions.left ?? 0, width: 0 };

    return { left: start.dimensions.left, width: end.dimensions.left + end.dimensions.width - start.dimensions.left };
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
