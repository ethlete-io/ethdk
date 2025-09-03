import {
  BracketElementToCreate,
  BracketMasterColumn,
  createBracketElement,
  createBracketMasterColumn,
  createBracketMasterColumnSection,
  createBracketSubColumn,
} from '../core';

export type CreateBracketGapMasterColumnConfig<TRoundData, TMatchData> = {
  existingMasterColumns: ReadonlyArray<BracketMasterColumn<TRoundData, TMatchData>>;
  columnGap: number;
};

export const createBracketGapMasterColumn = <TRoundData, TMatchData>(
  config: CreateBracketGapMasterColumnConfig<TRoundData, TMatchData>,
) => {
  const { existingMasterColumns, columnGap } = config;

  const lastMasterColumn = existingMasterColumns[existingMasterColumns.length - 1];

  if (!lastMasterColumn) {
    throw new Error('No last master column found in existing master columns');
  }

  const { masterColumn, pushSection } = createBracketMasterColumn<TRoundData, TMatchData>({
    columnWidth: columnGap,
    padding: {
      bottom: 0,
      left: 0,
      right: 0,
      top: 0,
    },
  });

  for (const section of lastMasterColumn.sections) {
    const { masterColumnSection, pushSubColumn } = createBracketMasterColumnSection<TRoundData, TMatchData>({
      type: 'gap',
    });

    const lastSubColumn = section.subColumns[section.subColumns.length - 1];

    if (!lastSubColumn) {
      throw new Error('No last sub column found in section');
    }

    const { pushElement, subColumn } = createBracketSubColumn<TRoundData, TMatchData>({
      span: {
        isStart: lastSubColumn.span.isEnd ? true : false,
        isEnd: lastSubColumn.span.isEnd ? true : false,
      },
    });

    for (const lastSubColumnElement of lastSubColumn.elements) {
      const partHeights = lastSubColumnElement.parts.map((part) => part.dimensions.height);

      const elementToCreate: BracketElementToCreate<TRoundData, TMatchData> = (() => {
        switch (lastSubColumnElement.type) {
          case 'matchGap':
          case 'roundHeaderGap':
          case 'roundGap':
          case 'colGap': {
            return {
              area: !lastSubColumn.span.isEnd ? lastSubColumnElement.area : `.`,
              type: !lastSubColumn.span.isEnd ? lastSubColumnElement.type : 'colGap',
              elementHeight: lastSubColumnElement.dimensions.height,
              partHeights,
            };
          }
          case 'header':
            if (lastSubColumn.span.isEnd) break;

            return {
              area: lastSubColumnElement.area,
              type: lastSubColumnElement.type,
              elementHeight: lastSubColumnElement.dimensions.height,
              partHeights,
              component: lastSubColumnElement.component,
              round: lastSubColumnElement.round,
              roundSwissGroup: lastSubColumnElement.roundSwissGroup,
            };

          case 'match':
            if (lastSubColumn.span.isEnd) break;

            return {
              area: lastSubColumnElement.area,
              type: lastSubColumnElement.type,
              elementHeight: lastSubColumnElement.dimensions.height,
              partHeights,
              component: lastSubColumnElement.component,
              round: lastSubColumnElement.round,
              match: lastSubColumnElement.match,
              roundSwissGroup: lastSubColumnElement.roundSwissGroup,
            };
        }

        return {
          area: `.`,
          type: 'colGap',
          elementHeight: lastSubColumnElement.dimensions.height,
          partHeights,
        };
      })();

      pushElement(createBracketElement<TRoundData, TMatchData>(elementToCreate).element);
    }

    pushSubColumn(subColumn);

    pushSection(masterColumnSection);
  }

  return masterColumn;
};
