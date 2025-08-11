export type BracketMasterColumn = {
  sections: BracketMasterColumnSection[];
  dimensions: Dimensions;
};

export type BracketMasterColumnSectionType = 'round' | 'gap';

export type BracketMasterColumnSection = {
  subColumns: BracketSubColumn[];
  dimensions: Dimensions;
  type: BracketMasterColumnSectionType;
};

export type BracketSubColumn = {
  dimensions: Dimensions;
  elements: BracketElement[];
  span: Span;
};

export type BracketElementType = 'match' | 'header' | 'matchGap' | 'roundHeaderGap' | 'roundGap' | 'colGap';

/**
 * An element is a slice of a section.
 * It can be a match, a header, a gap, etc.
 */
export type BracketElement = {
  type: BracketElementType;
  area: string;

  /** The dimensions of the actual element */
  dimensions: Dimensions;

  /** The dimensions of the container that holds the element */
  containerDimensions: Dimensions;

  parts: BracketElementPart[];
};

/**
 * A row is a part of an element.
 */
export type BracketElementPart = {
  dimensions: Dimensions;
};

export type Dimensions = {
  width: number;
  height: number;
  top: number;
  left: number;
};

export type Span = {
  isStart: boolean;
  isEnd: boolean;
};
