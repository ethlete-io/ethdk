import {
  BracketMasterColumn,
  createBracketElement,
  createBracketElementPart,
  createBracketMasterColumn,
  createBracketMasterColumnSection,
  createBracketSubColumn,
} from '../core';

export type CreateBracketGapMasterColumnColumnConfig = {
  existingMasterColumns: ReadonlyArray<BracketMasterColumn>;
  columnGap: number;
};

export const createBracketGapMasterColumnColumn = (config: CreateBracketGapMasterColumnColumnConfig) => {
  const { existingMasterColumns, columnGap } = config;

  const lastMasterColumn = existingMasterColumns[existingMasterColumns.length - 1];

  if (!lastMasterColumn) {
    throw new Error('No last master column found in existing master columns');
  }

  const { masterColumn, pushSection } = createBracketMasterColumn({
    columnWidth: columnGap,
  });

  for (const section of lastMasterColumn.sections) {
    const { masterColumnSection, pushSubColumn } = createBracketMasterColumnSection({
      type: 'gap',
    });

    const lastSubColumn = section.subColumns[section.subColumns.length - 1];

    if (!lastSubColumn) {
      throw new Error('No last sub column found in section');
    }

    const { pushElement, subColumn } = createBracketSubColumn({
      span: {
        isStart: true,
        isEnd: true,
      },
    });

    for (const lastSubColumnElement of lastSubColumn.elements) {
      const { element, pushPart } = createBracketElement({
        area: !lastSubColumn.span.isEnd ? lastSubColumnElement.area : `.`,
        type: !lastSubColumn.span.isEnd ? lastSubColumnElement.type : 'colGap',
        elementHeight: lastSubColumnElement.dimensions.height,
      });

      for (const lastSubColumnElementPart of lastSubColumnElement.parts) {
        pushPart(
          createBracketElementPart({
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
