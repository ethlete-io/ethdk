import { BracketElement, BracketSubColumn, Span } from './types';

export type CreateBracketSubColumnConfig = {
  span: Span;
};

export type MutableBracketSubColumn = {
  subColumn: BracketSubColumn;
  pushElement: (element: BracketElement) => void;
};

export const createBracketSubColumn = (config: CreateBracketSubColumnConfig): MutableBracketSubColumn => {
  const { span } = config;

  const elements: BracketElement[] = [];

  const newSubColumn: BracketSubColumn = {
    dimensions: {
      width: 0,
      height: 0,
      top: 0,
      left: 0,
    },
    elements,
    span,
  };

  const pushElement = (element: BracketElement) => {
    elements.push(element);
  };

  return {
    subColumn: newSubColumn,
    pushElement,
  };
};
