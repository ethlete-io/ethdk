/** One connector between two cards, ready for an SVG `<path>`. */
export type BracketEdge = {
  /**
   * Stable while only the geometry changes, so a template's `@for` moves the same `<path>` instead of
   * replacing it - which is what lets the `d` transition run. Unique within one drawing.
   */
  id: string;

  /** The `d` attribute, which is what draws the line. */
  d: string;

  /** The same path as a value for the CSS `d` property - the one a transition can animate. */
  cssPath: string;

  /** The participant short ids the journey highlight matches on, space separated. */
  cssClass: string;

  strokeWidth: number;
  dashArray: number;
  dashOffset: number;

  /** A color, or `url(#id)` naming one of the drawing's {@link BracketGradient}s. */
  stroke: string;
};

/** A box drawn behind the connectors - a swiss layout's group border. */
export type BracketRect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** The corner radius, as the `rx` attribute. */
  radius: number;
  cssClass: string;
  stroke: string;
  strokeWidth: number;
};

export type BracketGradientStop = {
  /** A CSS/SVG offset, e.g. `'50%'`. */
  offset: string;
  color: string;
};

/** A horizontal gradient in user space, which an edge's `stroke` names by `url(#id)`. */
export type BracketGradient = {
  id: string;
  fromX: number;
  toX: number;
  stops: BracketGradientStop[];
};

/**
 * Everything a layout draws between the cells, as data rather than as SVG markup: the host renders it
 * with `@for`, so nothing has to be trusted past the sanitizer and a connector can animate.
 */
export type BracketDrawing = {
  edges: BracketEdge[];
  rects: BracketRect[];
  gradients: BracketGradient[];
};
