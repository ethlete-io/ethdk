import { BracketPosition } from './math';
import { path, PathOptions } from './path';

export type LineOptions = {
  path: PathOptions;
};

// eslint-disable-next-line max-params -- geometry helper: (from, to, options) reads naturally positional
export const linePath = (from: BracketPosition, to: BracketPosition, options: LineOptions) => {
  return path(`M ${from.inline.end} ${from.block.center} L ${to.inline.start} ${to.block.center}`, options.path);
};
