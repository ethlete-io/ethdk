import { createBracketElement } from './bracket-element';
import { createBracketElementPart } from './bracket-element-part';
import { createBracketMasterColumn } from './bracket-master-column';
import { createBracketMasterColumnSection } from './bracket-master-column-section';
import { createBracketSubColumn } from './bracket-sub-column';
import { BracketMasterColumn } from './types';

export type CreateBracketGapMasterColumnColumnConfig = {
  existingMasterColumns: BracketMasterColumn[];
  columnGap: number;
};

export const createBracketGapMasterColumnColumn = (config: CreateBracketGapMasterColumnColumnConfig) => {
  const { existingMasterColumns, columnGap } = config;

  const lastMasterColumn = existingMasterColumns[existingMasterColumns.length - 1];

  if (!lastMasterColumn) {
    throw new Error('No last master column found in existing master columns');
  }

  const { masterColumn, pushSection } = createBracketMasterColumn({
    existingMasterColumns,
    columnWidth: columnGap,
  });

  for (const section of lastMasterColumn.sections) {
    const { masterColumnSection, pushSubColumn } = createBracketMasterColumnSection({
      masterColumn,
      type: 'gap',
    });

    const lastSubColumn = section.subColumns[section.subColumns.length - 1];

    if (!lastSubColumn) {
      throw new Error('No last sub column found in section');
    }

    const { pushElement, subColumn } = createBracketSubColumn({
      masterColumn,
      masterColumnSection,
      totalSubColumns: 1,
      span: {
        isStart: true,
        isEnd: true,
      },
    });

    for (const lastSubColumnElement of lastSubColumn.elements) {
      const { element, pushPart } = createBracketElement({
        area: !lastSubColumn.span.isEnd ? lastSubColumnElement.area : `.`,
        masterColumn,
        masterColumnSection,
        subColumn,
        type: !lastSubColumn.span.isEnd ? lastSubColumnElement.type : 'colGap',
        elementHeight: lastSubColumnElement.dimensions.height,
        isFirstSubColumn: true,
      });

      for (const lastSubColumnElementPart of lastSubColumnElement.parts) {
        pushPart(
          createBracketElementPart({
            element,
            subColumn,
            masterColumn,
            masterColumnSection,
            elementPartHeight: lastSubColumnElementPart.dimensions.height,
          }).elementPart,
        );
      }

      pushElement(element);
    }

    pushSubColumn(subColumn);

    pushSection(masterColumnSection);
  }

  return masterColumn;
};
