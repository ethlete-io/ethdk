export type PathOptions = {
  width: number;
  dashArray: number;
  dashOffset: number;
  className: string;
};

export const path = (d: string, options: PathOptions) =>
  `<path d="${d.replace(/\s+/g, ' ').trim()}" stroke="currentColor" fill="none" stroke-width="${options.width}" stroke-dasharray="${options.dashArray}" stroke-dashoffset="${options.dashOffset}" class="${options.className}" />`;
