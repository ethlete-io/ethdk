export type BracketGrid = {
  masterColumns: ReadonlyArray<BracketMasterColumn>;
  dimensions: Dimensions;
};

export type BracketMasterColumn = {
  sections: ReadonlyArray<BracketMasterColumnSection>;
  dimensions: Dimensions;
};

export type BracketMasterColumnSectionType = 'round' | 'gap';

export type BracketMasterColumnSection = {
  subColumns: ReadonlyArray<BracketSubColumn>;
  dimensions: Dimensions;
  type: BracketMasterColumnSectionType;
};

export type BracketSubColumn = {
  dimensions: Dimensions;
  elements: ReadonlyArray<BracketElement>;
  span: Span;
};

export type BracketElementType = 'match' | 'header' | 'matchGap' | 'roundHeaderGap' | 'roundGap' | 'colGap';

export type BracketElementSpanCoordinates = {
  masterColumnStart: number;
  masterColumnEnd: number;
  sectionStart: number;
  sectionEnd: number;
  subColumnStart: number;
  subColumnEnd: number;
};

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

  parts: ReadonlyArray<BracketElementPart>;

  span?: BracketElementSpanCoordinates;

  isHidden?: boolean;
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
