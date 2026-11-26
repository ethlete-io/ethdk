import { BracketEdge } from './shapes';

export type PathOptions = {
  /** Unique within one drawing - see {@link BracketEdge.id}. */
  id: string;
  width: number;
  dashArray: number;
  dashOffset: number;
  className: string;
  stroke?: string;
};

export const path = (d: string, options: PathOptions): BracketEdge => {
  const commands = d.replace(/\s+/g, ' ').trim();

  return {
    id: options.id,
    d: commands,
    cssPath: `path("${commands}")`,
    cssClass: options.className,
    strokeWidth: options.width,
    dashArray: options.dashArray,
    dashOffset: options.dashOffset,
    stroke: options.stroke ?? 'currentColor',
  };
};
