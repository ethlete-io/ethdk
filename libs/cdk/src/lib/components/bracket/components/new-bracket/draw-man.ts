import { BracketGridRoundItem } from './grid-placements';

export type DrawManDimensions = {
  columnWidth: number;
  matchHeight: number;
  roundHeaderHeight: number;
  columnGap: number;
  rowGap: number;
};

export const drawMan = <TRoundData, TMatchData>(
  items: BracketGridRoundItem<TRoundData, TMatchData>[],
  dimensions: DrawManDimensions,
) => {
  // const { columnWidth, matchHeight, rowGap,columnGap,roundHeaderHeight } = dimensions;
  // const columnGapCenter = columnGap / 2;
  // const canvas = document.createElement('canvas');
  // const ctx = canvas.getContext('2d')!;
  // const width = items.reduce((acc, item) => Math.max(acc, item.columnEnd), 0) * columnWidth;
  // const height = items.reduce((acc, item) => acc + (item.rowEnd - item.rowStart) * matchHeight, 0);
  // canvas.width = width;
  // canvas.height = height;
  // ctx.fillStyle = 'white';
  // ctx.fillRect(0, 0, width, height);
  // let y = 0;
  // for (const item of items) {
  //     for (const subItem of item.items) {
  //     const x = subItem.columnStart * columnWidth;
  //     const w = (subItem.columnEnd - subItem.columnStart) * columnWidth;
  //     const h = (subItem.rowEnd - subItem.rowStart) * matchHeight;
  //     ctx.fillStyle = 'black';
  //     ctx.fillRect(x, y, w, h);
  //     }
  //     y += (item.rowEnd - item.rowStart) * matchHeight + rowGap;
  // }
  // return canvas.toDataURL();
};
